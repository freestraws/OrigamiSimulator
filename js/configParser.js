const fs = require("fs");
const ini = require("ini");
const path = require("path");

module.exports.config = class{
    constructor(_path='./config.ini'){
        this.path = _path;
        this.config = ini.parse(fs.readFileSync(path.resolve(__dirname, this.path), 'utf-8'));
    }

    get_as_object(){
        return this.config;
    }
    
    write(new_config){
        fs.writeFileSync(this.path, ini.stringify(new_config));
    }
};
