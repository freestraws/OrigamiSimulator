/**
 * Created by ghassaei on 9/16/16.
 */
const THREE = require("three");
var nodeMaterial = new THREE.MeshBasicMaterial({color: 0x000000, side:THREE.DoubleSide});
var transparentMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, opacity:0.5, transparent:true});
var transparentVRMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, opacity:0.8, transparent:true});

var nodeGeo = new THREE.SphereGeometry(0.02,20);
module.exports.Node = class{
    constructor(position, index){
        this.type = "node";
        this.index = index;
        this._originalPosition = position.clone();
        this.currentPosition = this._originalPosition;

        this.beams = [];
        this.creases = [];
        this.invCreases = [];
        this.externalForce = null;
        this.fixed = false;

        // this.render(new THREE.Vector3(0,0,0));
    }

    setFixed(fixed){
        this.fixed = fixed;
        // if (fixed) {
        //     this.object3D.material = nodeMaterialFixed;
        //     this.object3D.geometry = nodeFixedGeo;
        //     if (this.externalForce) this.externalForce.hide();
        // }
        // else {
        //     this.object3D.material = nodeMaterial;
        //     this.object3D.geometry = nodeGeo;
        //     if (this.externalForce) this.externalForce.show();
        // }
    }

    isFixed(){
        return this.fixed;
    }

    //forces

    addExternalForce(force){
        // this.externalForce = force;
        // var position = this.getOriginalPosition();
        // this.externalForce.setOrigin(position);
        // if (this.fixed) this.externalForce.hide();
    }

    getExternalForce(){
        if (!this.externalForce) return new THREE.Vector3(0,0,0);
        return this.externalForce.getForce();
    }

    addCrease(crease){
        this.creases.push(crease);
    }

    removeCrease(crease){
        if (this.creases === null) return;
        var index = this.creases.indexOf(crease);
        if (index>=0) this.creases.splice(index, 1);
    }

    addInvCrease(crease){
        this.invCreases.push(crease);
    }

    removeInvCrease(crease){
        if (this.invCreases === null) return;
        var index = this.invCreases.indexOf(crease);
        if (index>=0) this.invCreases.splice(index, 1);
    }

    addBeam(beam){
        this.beams.push(beam);
    }

    removeBeam(beam){
        if (this.beams === null) return;
        var index = this.beams.indexOf(beam);
        if (index>=0) this.beams.splice(index, 1);
    }

    getBeams(){
        return this.beams;
    }

    numBeams(){
        return this.beams.length;
    }

    isConnectedTo(node){
        for (var i=0;i<this.beams.length;i++){
            if (this.beams[i].getOtherNode(this) == node) return true;
        }
        return false;
    }

    numCreases(){
        return this.creases.length;
    }

    getIndex(){//in nodes array
        return this.index;
    }

    getObject3D(){
        return this.object3D;
    }

    // highlight(){
    //     this.object3D.material = nodeMaterialHighlight;
    // };
    //
    // unhighlight(){
    //     if (!this.object3D) return;
    //     if (this.fixed) {
    //         this.object3D.material = nodeMaterialFixed;
    //     }
    //     else {
    //         this.object3D.material = nodeMaterial;
    //     }
    // };

    setTransparent(){
        if (!this.object3D){
            this.object3D = new THREE.Mesh(nodeGeo, nodeMaterial);
            this.object3D.visible = false;
        }
        this.object3D.material = transparentMaterial;
    }

    setTransparentVR(){
        if (!this.object3D){
            this.object3D = new THREE.Mesh(nodeGeo, nodeMaterial);
            this.object3D.visible = false;
        }
        this.object3D.material = transparentVRMaterial;
        this.object3D.scale.set(0.4, 0.4, 0.4);
    }

    // hide(){
    //     this.object3D.visible = false;
    // };

    // render(position){
        // if (this.fixed) return;
        // position.add(this.getOriginalPosition());
        // console.log(position);
        // this.object3D.position.set(position.x, position.y, position.z);
        // return position;
    // };
    // renderDelta(delta){
    //     // if (this.fixed) return;
    //     this.object3D.position.add(delta);
    //     return this.object3D.position;
    // };

    // renderChange(change){
    //     this.object3D.position.add(change);
    // };


    //dynamic solve

    getOriginalPosition(){
        return this._originalPosition.clone();
    }

    setOriginalPosition(x, y, z){
        this._originalPosition.set(x, y, z);
    }

    getPosition(){
        // var positions = globals.model.getPositionsArray();
        // var i = this.getIndex();
        // return new THREE.Vector3(positions[3*i], positions[3*i+1], positions[3*i+2]);
        return this.currentPosition;
    }

    moveManually(position){
        // var positions = globals.model.getPositionsArray();
        // var i = this.getIndex();
        // positions[3*i] = position.x;
        // positions[3*i+1] = position.y;
        // positions[3*i+2] = position.z;
        this.currentPosition = position;
    }

    getRelativePosition(){
        return this.getPosition().sub(this._originalPosition);
    }

    getSimMass(){
        return 1;
    }

    //deallocate
    destroy(){
        //object3D is removed in outer scope
        this.object3D = null;
        this.beams = null;
        this.creases = null;
        this.invCreases = null;
        this.externalForce = null;
    }
};