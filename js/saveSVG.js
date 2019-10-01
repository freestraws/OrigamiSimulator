module.exports.saveSVG = function(){
    if (globals.extension == "fold"){
        //todo solve for crease pattern
        globals.warn("No crease pattern available for files imported from FOLD format.");
        return;
    }
    var serializer = new XMLSerializer();
    var source = serializer.serializeToString($("#svgViewer>svg").get(0));
    var svgBlob = new Blob([source], {type:"image/svg+xml;charset=utf-8"});
    var svgUrl = URL.createObjectURL(svgBlob);
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download =  globals.filename + ".svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}