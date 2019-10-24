/**
 * Created by ghassaei on 2/24/16.
 * nodified by freestraws on 10/1/2019
 */
const GLBoilerPlate = require("./GLBoilerPlate").GLBoilerPlate;
var width   = 64;
var height  = 64;
var gl = require('gl')(width, height, { preserveDrawingBuffer: true });

const fs = require('fs');

module.exports.GPUMath = class {
    constructor(){
        this.glBoilerplate = new GLBoilerPlate();
        this.gl = gl;
        this.floatTextures = this.gl.getExtension('OES_texture_float');
        if (!this.floatTextures) {
            this.notSupported();
        }
        this.gl.disable(this.gl.DEPTH_TEST);
        this.maxTexturesInFragmentShader = this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS);
        console.log(this.maxTexturesInFragmentShader + " textures max");
        this.reset();
    }

    notSupported(){
        console.warn("floating point textures are not supported on your system");
    }

    createProgram(programName, vertexShader, fragmentShader){
        fragmentShader = fs.readFileSync(fragmentShader);
        var programs = this.programs;
        var program = programs[programName];
        if (program) {
            this.gl.useProgram(program.program);
            console.warn("already a program with the name " + programName);
            return;
        }
        program = this.glBoilerplate.createProgramFromSource(this.gl, vertexShader, fragmentShader);
        this.gl.useProgram(program);
        this.glBoilerplate.loadVertexData(this.gl, program);
        programs[programName] = {
            program: program,
            uniforms: {}
        };
    }

    initTextureFromData(name, width, height, typeName, data, shouldReplace){
        var texture = this.textures[name];

        if (texture){
            if (!shouldReplace) {
                console.warn("already a texture with the name " + name);
                return;
            }
            this.gl.deleteTexture(texture);
        }
        texture = this.glBoilerplate.makeTexture(this.gl, width, height, this.gl[typeName], data);
        this.textures[name] = texture;
    }

    initFrameBufferForTexture(textureName, shouldReplace){
        var framebuffer = this.frameBuffers[textureName];
        if (framebuffer){
            if (!shouldReplace) {
                console.warn("framebuffer already exists for texture " + textureName);
                return;
            }
            this.gl.deleteFramebuffer(framebuffer);
        }
        var texture = this.textures[textureName];
        if (!texture){
            console.warn("texture " + textureName + " does not exist");
            return;
        }

        framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);

        var check = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
        if(check != this.gl.FRAMEBUFFER_COMPLETE){
            this.notSupported();
        }

        this.frameBuffers[textureName] = framebuffer;
    }

    setUniformForProgram(programName, name, val, type){
        if (!this.programs[programName]){
            console.warn("no program with name " + programName);
            return;
        }
        var uniforms = this.programs[programName].uniforms;
        var location = uniforms[name];
        if (!location) {
            location = this.gl.getUniformLocation(this.programs[programName].program, name);
            uniforms[name] = location;
        }
        if (type == "1f") this.gl.uniform1f(location, val);
        else if (type == "2f") this.gl.uniform2f(location, val[0], val[1]);
        else if (type == "3f") this.gl.uniform3f(location, val[0], val[1], val[2]);
        else if (type == "1i") this.gl.uniform1i(location, val);
        else {
            console.warn("no uniform for type " + type);
        }
    }

    setSize(width, height){
        this.gl.resize(width, height);
    };

    setProgram(programName){
        var program = this.programs[programName];
        if (program) this.gl.useProgram(program.program);
    };

    step(programName, inputTextures, outputTexture, time){
        this.gl.useProgram(this.programs[programName].program);
        if (time) this.setUniformForProgram(programName, "u_time", time, "1f");
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.frameBuffers[outputTexture]);
        for (var i=0; i<inputTextures.length; i++){
            this.gl.activeTexture(this.gl.TEXTURE0 + i);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[inputTextures[i]]);
        }
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);//draw to framebuffer
    };

    swapTextures(texture1Name, texture2Name){
        var temp = this.textures[texture1Name];
        this.textures[texture1Name] = this.textures[texture2Name];
        this.textures[texture2Name] = temp;
        temp = this.frameBuffers[texture1Name];
        this.frameBuffers[texture1Name] = this.frameBuffers[texture2Name];
        this.frameBuffers[texture2Name] = temp;
    };

    swap3Textures(texture1Name, texture2Name, texture3Name){
        var temp = this.textures[texture3Name];
        this.textures[texture3Name] = this.textures[texture2Name];
        this.textures[texture2Name] = this.textures[texture1Name];
        this.textures[texture1Name] = temp;
        temp = this.frameBuffers[texture3Name];
        this.frameBuffers[texture3Name] = this.frameBuffers[texture2Name];
        this.frameBuffers[texture2Name] = this.frameBuffers[texture1Name];
        this.frameBuffers[texture1Name] = temp;
    };

    readyToRead(){
        return this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) == this.gl.FRAMEBUFFER_COMPLETE;
    };

    readPixels(xMin, yMin, width, height, array){
        this.gl.readPixels(xMin, yMin, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, array);
    };

    reset(){
        this.programs = {};
        this.frameBuffers = {};
        this.textures = {};
        this.index = 0;
    };
};