import { readFileSync, writeFileSync } from 'fs'
import { parse, stringify } from 'ini'

export default class config{
    constructor(path='./config.ini'){
        this.path = path
        this.config = parse(readFileSync(path, 'utf-8'))
    }

    get_as_object(){
        return this.config
    }
    
    write(new_config){
        writeFileSync(this.path, stringify(new_config))
    }
}
