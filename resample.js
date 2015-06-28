"use strict";

function assert(condition, message) {
    if (!condition) {
        message = message || "Assertion failed";
        if (typeof Error !== "undefined") {
            throw new Error(message);
        }
        throw message; // Fallback
    }
}



var Resample = {};

Resample.getSrcPosition = function (dstpos, factor) {
    // Offset is the center of the very first interpolation
    var offset = (1 / factor - 1) / 2;
    var position = dstpos / factor + offset;
    return position + offset;
}

Resample.getPixels = function (img) {
    var c, ctx;
    if (img.getContext) {
	c = img;
	try { ctx = c.getContext('2d'); } catch(e) {}
    }
    if (!ctx) {
	c = this.createCanvas(img.width, img.height);
	ctx = c.getContext('2d');
	ctx.drawImage(img, 0, 0);
    }
    return ctx.getImageData(0,0,c.width,c.height);
};

Resample.createPixels = function (width, height) {
    var c = this.createCanvas(width, height);
    var ctx = c.getContext('2d');
    return ctx.getImageData(0,0,width, height);
}

Resample.createCanvas = function (width, height) {
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
};

Resample.nearestNeighbor = function (src, dst) {
    var sd = src.data;
    var dd = dst.data;
    assert(sd.length === src.width * src.height * 4);
    assert(dd.length === dst.width * dst.height * 4);
    var factorX = dst.width / src.width;
    var factorY = dst.height / src.height;
    assert (Math.abs(factorX - factorY) < Number.MIN_VALUE);
    var k = 0;
    for (var i = 0; i < dst.height; i++) {
	for (var j = 0; j < dst.width; j++) {
	    var iSrc = Math.round(this.getSrcPosition (i, factorY));
	    var jSrc = Math.round(this.getSrcPosition (j, factorX));
	    var kSrc = (iSrc * src.width + jSrc) * 4;
	    dd[k + 0] = sd[kSrc + 0];
	    dd[k + 1] = sd[kSrc + 1];
	    dd[k + 2] = sd[kSrc + 2];
	    dd[k + 3] = sd[kSrc + 3];
	    k += 4;
	}
    }
    return dst;
}

function clamp (x, min, max) {
    return Math.max(Math.min (x, max), min);
}

Resample.separableFilter = function (src, dst, filter) {
    var i, j, k, l, m;
    var dstval;
    var tmp = new Array (src.height * dst.width * 4);
    var factorX = dst.width / src.width;
    var factorY = dst.height / src.height;
    var sd = src.data;
    var dd = dst.data;

    // Execute horizontal resampling
    m = 0;
    for (i = 0; i < src.height; i++) {
        for (j = 0; j < dst.width; j++) {
            dstval = [0, 0, 0, 0];
            for (k = 0; k < filter.tapsX[j].n; k++) {
                for (l = 0; l < 4; l++)
                    dstval[l] += filter.tapsX[j].coeff[k] * sd[(i * src.width  + filter.tapsX[j].pos[k]) * 4 + l];
            }
            for (l = 0; l < 4; l++)
                tmp[m + l] = dstval[l];
            m += 4;
        }
    }

    // Execute vertical resampling
    m = 0;
    for (i = 0; i < dst.height; i++) {
        for (j = 0; j < dst.width; j++) {
            dstval = [0, 0, 0, 0];
            for (k = 0; k < filter.tapsY[i].n; k++) {
                for (l = 0; l < 4; l++)
                    dstval[l] += filter.tapsY[i].coeff[k] * tmp[(filter.tapsY[i].pos[k] * dst.width + j) * 4 + l];
            }
            for (l = 0; l < 4; l++)
                dd[m + l] = dstval[l];
            m += 4;
        }
    }

    return dst;
}

// Resample.bilinear = function (src, dst, args) {
//     var filter = new Filter(FilterFunc.triangle, 1);
//     filter.initialize(src.width, src.height, dst.width, dst.height);
//     return this.separableFilter(src, dst, filter);
// }


Resample.resampleImage = function (filter, image, factor) {
    var wDst = Math.round(image.width * factor);
    var hDst = Math.round(image.height * factor);
    var pixelsSrc = this.getPixels(image);
    var pixelsDst = this.createPixels(wDst, hDst);
    var args = [pixelsSrc, pixelsDst, filter];
    for (var i=2; i<arguments.length; i++) {
        args.push(arguments[i]);
    }
    filter.initialize(pixelsSrc.width, pixelsSrc.height, pixelsDst.width, pixelsDst.height);
    return filter.process.apply(this, args);
};

function FilterDef (support, processFunc, generateFunc) {
    this.support = support;
    this.process = processFunc;
    this.generate = generateFunc;
    this.tapsX = null;
    this.tapsY = null;
}

var Filter = {}
Filter.filters = {};

// aka nearest neighbor
Filter.filters.point = new FilterDef(null, Resample.nearestNeighbor, null);

// aka averaging
Filter.filters.box = new FilterDef(0.5, Resample.separableFilter,
    function (x) {
        return (x >= -0.5 && x < 0.5) ? 1 : 0;
    }
);

// aka bilinear
Filter.filters.triangle = new FilterDef(1, Resample.separableFilter,
    function (x) {
        if (x < 0)
            x = -x;
        return (x < 1) ? (1 - x) : 0;
    }
);


FilterDef.prototype.initialize = function (srcWidth, srcHeight, dstWidth, dstHeight) {

    function calcualteFilterTaps(srcX, dstX, support, generate) {
        var scale = dstX / srcX;
        var filterWidth = 2 * support / scale;
        var filterTaps = [];
        for (var i = 0; i < dstX; i++) {
            var taps = [];
            var srcPos = [];

            var center = (i + 0.5) / scale - 0.5;
            var left = Math.floor(center - filterWidth/2);
            var right = Math.ceil(center + filterWidth/2);
            var filterLength = right - left + 1;

            var phase = center - Math.floor(center) - filterLength/2;
            var sum = 0;
            for (var j = 0; j < filterLength; j++, phase++) {
                taps[j] = generate(phase * scale);
                srcPos[j] = clamp(Math.floor(center - filterLength/2 + j), 0, srcWidth);
                sum += taps[j];
            }

            // Normalize
            for (var j = 0; j < filterLength; j++)
                taps[j] /= sum;


            filterTaps[i] = {coeff: taps, pos: srcPos, n : filterLength};
        }
        return filterTaps;
    }

    if (this.generate) {
        this.tapsX = calcualteFilterTaps(srcWidth, dstWidth, this.support, this.generate);
        this.tapsY = calcualteFilterTaps(srcHeight, dstHeight, this.support, this.generate);
    }
}


function runResample(canvasid, imgid, factor) {
    var timeStart = performance.now();
    assert(canvasid);
    assert(imgid);
    assert(factor);
    var canvas = document.getElementById(canvasid);
    var srcimg = document.getElementById(imgid);
    var filtername = document.getElementById("method").value;
    var filter = Filter.filters[filtername]
    assert (filter, "Invalid filter name '" + filtername + "'");
    var imgdata = Resample.resampleImage(filter, srcimg, factor);
    canvas.width = imgdata.width;
    canvas.height = imgdata.height;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(imgdata, 0, 0);
    canvas.style.display = 'inline';
    var timeEnd = performance.now();
    console.log("Resampling with " + filtername + " took " + (timeEnd - timeStart) + " ms.");
}
