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

var Resample = {}

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

Resample.nearestNeighbor = function (src, dst, args) {
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

Resample.resampleImage = function (filter, image, factor) {
    var wDst = Math.round(image.width * factor);
    var hDst = Math.round(image.height * factor);
    var pixelsSrc = this.getPixels(image);
    var pixelsDst = this.createPixels(wDst, hDst);
    var args = [pixelsSrc, pixelsDst];
    for (var i=2; i<arguments.length; i++) {
	args.push(arguments[i]);
    }
    return filter.apply(this, args);
};


function runResample(canvasid, imgid, factor) {
    var timeStart = performance.now();
    assert(canvasid);
    assert(imgid);
    assert(factor);
    var canvas = document.getElementById(canvasid);
    var srcimg = document.getElementById(imgid);
    var filtername = document.getElementById("method").value;
    var filterfunc = Resample[filtername]
    assert (filterfunc, "Invalid filter name '" + filtername + "'");
    var imgdata = Resample.resampleImage(filterfunc, srcimg, factor);
    canvas.width = imgdata.width;
    canvas.height = imgdata.height;
    var ctx = canvas.getContext('2d');
    ctx.putImageData(imgdata, 0, 0);
    canvas.style.display = 'inline';
    var timeEnd = performance.now();
    console.log("Call runResample() took " + (timeEnd - timeStart) + " ms.");
}
