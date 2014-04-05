function getColorBlindImage(imagesBaseUrl, image, canvas){
	function backgroundFor( iteration, complete, start, end, step, pauseStep, timeInterval) {
		var index = start;
		if(index == end) return;
		function iterate() {
			iteration(index);
			index += step;
			if(index < end) {
				if( index % pauseStep == 0) { 
					setTimeout(iterate, timeInterval);
				}
				else {
					iterate();
				}
			}
			else {
				complete();
			}
		}
		iterate();
	}

	function RGBtoXYZ(rgb)
	{
		rf = parseFloat( rgb.r / 255 );
		gf = parseFloat( rgb.g / 255 );
		bf = parseFloat( rgb.b / 255 );

		if ( rf > 0.04045 ) {
			rf = Math.pow((rf + 0.055)/1.055, 2.4);
		}
		else {
			rf = rf/12.92;
		}
		if ( gf > 0.04045 ) {
			gf = Math.pow((gf + 0.055)/1.055, 2.4);
		}
		else {
			gf = gf/12.92;
		}
		if ( bf > 0.04045 ) {
			bf = Math.pow((bf + 0.055)/1.055, 2.4);
		}
		else {
			bf = bf/12.92;
		}

		rf = rf * 100;
		gf = gf * 100;
		bf = bf * 100;

		return { 
			x : rf * 0.4124 + gf * 0.3576 + bf * 0.1805,
			y : rf * 0.2126 + gf * 0.7152 + bf * 0.0722, 
			z : rf * 0.0193 + gf * 0.1192 + bf * 0.9505,
			rgb : {r : rgb.r, g : rgb.g, b : rgb.b}};
	}

	function XYZtoLAB(xyz)
	{
		x = xyz.x/95.047;     
		y = xyz.y/100.000;          
		z = xyz.z/108.883;          

		if ( x > 0.008856 ) {
			x = Math.pow(x, 1/3);
		}
		else {
			x = 7.787 * x + 16/116;
		}
		if ( y > 0.008856 ) {
			y = Math.pow(y, 1/3);
		}
		else {
			y = 7.787 * y + 16/116;
		}
		if ( z > 0.008856 ) {
			z = Math.pow(z, 1/3);
		}
		else {
			z = 7.787 * z + 16/116;
		}

		return {
			L: 116 * y - 16,
			a: 500 * ( x - y ),
			b: 200 * ( y - z ),
			xyz: xyz, 
			rgb: xyz.rgb};
	}

	function compareCie94(labA, labB){
		var deltaL = labA.L - labB.L;
		var deltaA = labA.a - labB.a;
		var deltaB = labA.b - labB.b;

		var c1 = Math.sqrt(labA.a * labA.a + labA.b * labA.b);
		var c2 = Math.sqrt(labB.a * labB.a + labB.b * labB.b);
		var deltaC = c1 - c2;

		var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
		if(deltaH < 0) {
			deltaH = 0;
		}
		else {
			deltaH = Math.sqrt(deltaH);
		}

		var sl = 1.0;
		var kc = 1.0;
		var kh = 1.0;
		
		var K1 = 0.045;
		var K2 = 0.015;
		var Kl = 1.0;

		var sc = 1.0 + K1 * c1;
		var sh = 1.0 + K2 * c1;

		var deltaLKlsl = deltaL / (Kl * sl);
		var deltaCkcsc = deltaC / (kc * sc);
		var deltaHkhsh = deltaH / (kh * sh);
		var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
		if(i < 0) {
			return 0;
		}
		else
			return Math.sqrt(i);
	}

	function copyImageData(ctx, src)
	{
		try {
			var dst = ctx.createImageData(src.width, src.height);
			dst.data.set(src.data);
			return dst;
		}
		catch(e){
			var tmpCanvas = document.createElement('canvas');
			tmpCanvas.width = src.width;
			tmpCanvas.height = src.height;
			var ctx = tmpCanvas.getContext('2d');
			ctx.putImageData(src, 0, 0, 0, 0, src.width, src.height);
			return ctx.getImageData(0, 0, src.width, src.height);
		}
	}

	function colorBlindImage(image, canvas) {
		this._image = image;
		this._imgCanvas = canvas;
	}

	colorBlindImage.prototype.initialize = function(mode, progress, end) {
		if(!this._imgCanvas) {
			this._imgCanvas = document.createElement('canvas');
			this._dynamicImgCanvas = true;
		}
		else {
			delete this._dynamicImgCanvas;
		}

		this._imgCtx = this._imgCanvas.getContext('2d');
		this._imgCtx.clearRect (0, 0, this._imgCanvas.width, this._imgCanvas.height);
		this._imgCanvas.width = this._image.width;
		this._imgCanvas.height = this._image.height;
		this._imgCanvas.style.width = this._image.width + 'px';
		this._imgCanvas.style.height = this._image.height + 'px';
		this._imgCtx.drawImage(this._image, 0, 0);
		
		this._imgdInit = this._imgCtx.getImageData(0, 0, this._image.width, this._image.height);
		this._imgdInitColorIndexes = [];
		this._colors = [];
		
		var labsByRgb = {};
		var lastP = 0;
		var me = this;
		function iteration(i) {
			var rgb = {
				r : me._imgdInit.data[i], 
				g : me._imgdInit.data[i+1], 
				b : me._imgdInit.data[i+2], 
				alpha : me._imgdInit.data[i+3]};
					
			if(labsByRgb[rgb.r] && labsByRgb[rgb.r][rgb.g] && labsByRgb[rgb.r][rgb.g][rgb.b]) {
				var colorIndex = labsByRgb[rgb.r][rgb.g][rgb.b];
				var color = me._colors[colorIndex];
				me._imgdInitColorIndexes.push(colorIndex);
				color.positions.push(i);
			}
			else {
				if(labsByRgb[rgb.r] === undefined)labsByRgb[rgb.r] = {};
				if(labsByRgb[rgb.r][rgb.g] === undefined) labsByRgb[rgb.r][rgb.g] = {};
				
				var xyz = RGBtoXYZ(rgb);
				var lab = XYZtoLAB(xyz);
				
				labsByRgb[rgb.r][rgb.g][rgb.b] = me._colors.length;
				lab.positions = [i];
				
				for(var j = 0; j < me._colors.length; j++){
					var color = me._colors[j];
					if(compareCie94(lab, color) < 7){					
						color.positions.push(i);
						me._imgdInitColorIndexes.push(j);
						lab = null;
						labsByRgb[rgb.r][rgb.g][rgb.b] = j;
						break;
					}
				}
				
				if(lab != null) {
					me._imgdInitColorIndexes.push(me._colors.length);
					me._colors.push(lab);
				}
			}
			
			if(progress) {
				var p = Math.round(i * 100.0 / me._imgdInit.data.length);
				if(p != lastP) {
					progress(p);
					lastP = p;
				}
			}
		}
		
		backgroundFor(iteration, function () {
			labsByRgb = null;
			mode.call(me);
			if(end){
				end();
			}
		}, 0, me._imgdInit.data.length, 4, 7000, 1);
	}

	colorBlindImage.prototype.interactiveMode = function() {
		this.mode = this.interactiveMode;
		var patternImg = new Image();
		var me = this;
		patternImg.onload = function() {
			var patternCanvas = document.createElement('canvas');
			var patternCtx = patternCanvas.getContext('2d');
			
			patternCanvas.width = patternImg.width;
			patternCanvas.height = patternImg.height;
			patternCtx.drawImage(patternImg, 0, 0);
			
			var patternd = patternCtx.getImageData(0, 0, patternCanvas.width, patternCanvas.height);
			var lastColor = null;
			
			var elt = me._imgCanvas;
			if(me._dynamicImgCanvas) {
				elt = me._image;
			}
			
			function getMousePosition(event){
				return {
					x: event.pageX - elt.offsetLeft,
					y: event.pageY - elt.offsetTop,
				}
			}
			
			elt.onmousemove = function(e){
				var p = getMousePosition(e);
				var i = p.x * 4 + p.y * me._image.width * 4;
				
				var color = me._colors[me._imgdInitColorIndexes[i/4]];
				if((color.rgb.r > 250 && color.rgb.g > 250 & color.rgb.b > 250) || color.rgb.alpha == 0 || color === lastColor) {
					return;
				}
				lastColor = color;
							
				var imgd = copyImageData(me._imgCtx, me._imgdInit);
				
				me.colorPixelPattern(color, imgd, patternImg, patternd);
				
				me._imgCtx.putImageData(imgd, 0, 0, 0, 0, me._image.width, me._image.height);
				
				if(me._dynamicImgCanvas) {
					me._image.src = me._imgCanvas.toDataURL();
				}
			};
		};
		patternImg.src = imagesBaseUrl + 'pattern1.png';
	}

	colorBlindImage.prototype.hashingMode = function() {
		this.mode = this.hashingMode;
		
		var colors = this._colors.slice(0).sort(function(c1,c2){ 
			if(c1.rgb.r + c1.rgb.g + c1.rgb.b > 720) return 1;
			if(c1.rgb.r + c1.rgb.g + c1.rgb.b < 120) return 1;
			return c2.positions.length - c1.positions.length; 
		});

		var imgd = copyImageData(this._imgCtx, this._imgdInit);
		var patternImg = new Image();
		var me = this;
		var currentColorIndex = 0;
		var patternId = 0;
		patternImg.onerror = function(){
			me._imgCtx.putImageData(imgd, 0, 0, 0, 0, me._image.width, me._image.height);
			if(me._dynamicImgCanvas) {
				me._image.src = me._imgCanvas.toDataURL();
			}
		};
		patternImg.onload = function() {
			var patternCanvas = document.createElement('canvas');
			var patternCtx = patternCanvas.getContext('2d');
			
			patternCanvas.width = patternImg.width;
			patternCanvas.height = patternImg.height;
			patternCtx.drawImage(patternImg, 0, 0);
			
			var patternd = patternCtx.getImageData(0, 0, patternCanvas.width, patternCanvas.height);
			var patternUrl = null;
			
			var color = colors[currentColorIndex];
			if((color.rgb.r < 240 || color.rgb.g < 240 || color.rgb.b < 240) && (color.rgb.r > 50 || color.rgb.g > 50 || color.rgb.b > 50)){
				me.colorPixelPattern(color, imgd, patternImg, patternd);			
				patternId++;
				patternUrl = imagesBaseUrl + 'pattern' + patternId + '.png';
			}
			else{
				patternUrl = imagesBaseUrl + 'pattern' + patternId + '.png?'+ new Date().getTime();
			}
					
			currentColorIndex++;
			
			if(currentColorIndex < colors.length){
				patternImg.src = patternUrl;
			}
			else {
				me._imgCtx.putImageData(imgd, 0, 0, 0, 0, me._image.width, me._image.height);
				if(me._dynamicImgCanvas) {
					me._image.src = me._imgCanvas.toDataURL();
				}
			}
		};
		
		patternImg.src = 'img/pattern0.png';
	}

	colorBlindImage.prototype.reset = function(){
		if(this.mode === this.interactiveMode){
			var elt = this._imgCanvas;
			if(this._dynamicImgCanvas) {
				elt = this._image;
			}
			elt.onmousemove = null;
		}
		this._imgCtx.putImageData(this._imgdInit, 0, 0, 0, 0, this._image.width, this._image.height);
	}

	colorBlindImage.prototype.colorPixelPattern = function(color, imgd, patternImg, patternd){
		for(var p = 0; p < color.positions.length; p++){
			var pp = color.positions[p];
			
			var y = Math.floor(pp / 4 / this._image.width);
			var x = pp / 4 - y * this._image.width;
			
			var px = x % patternImg.width, py = y % patternImg.height;
			var patternPosition = (px + py * patternImg.width) * 4;
							
			if(patternd.data[patternPosition] == 0 && patternd.data[patternPosition+1] == 0 && patternd.data[patternPosition+2] == 0 && patternd.data[patternPosition+3] == 255){
				var value = 0;
				if((imgd.data[pp] + imgd.data[pp+1] + imgd.data[pp+2])/3 < 100) value = 255;
				
				imgd.data[pp] = value;
				imgd.data[pp+1] = value;
				imgd.data[pp+2] = value;
			}
		}
	}
	
	return new colorBlindImage(image, canvas);
}