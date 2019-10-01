/**
 * Created by amandaghassaei on 5/6/17.
 */

const globals = require("./globals")
const fs = require("fs")
const loadSVG = require("./loadSVG")
const loadFOLD = require("./loadFOLD")

module.exports.importDemoFile = function(url){
    var extension = url.split(".");
    var name = extension[extension.length-2].split("/");
    name = name[name.length-1];
    extension = extension[extension.length-1];
    // globals.setCreasePercent(0);
    if (extension == "svg"){
        globals.url = url;
        globals.filename = name;
        globals.extension = extension;
        loadSVG.load("assets/" + url);
    } else {
        console.warn("unknown extension: " + extension);
    }
}

module.exports.fileSelected = function(file){
    var extension = file.name.split(".");
    var name = extension[0];
    extension = extension[extension.length - 1];
    fs.readFile(file, function(err, data){
        console.log(err.stack)
        globals.filename = name;
        globals.extension = extension;
        globals.url = null;
        
        if (extension == "svg") {
            loadSVG.load(data);
        } else if (extension == "fold"){
            try {
                loadFOLD.load(data)
            } catch(err) {
                globals.warn("Unable to parse FOLD json.");
                console.log(err);
            }
        } else {
            globals.warn('Unknown file extension: .' + extension);
            return null;
        }
    });
}