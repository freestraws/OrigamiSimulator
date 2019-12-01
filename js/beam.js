/**
 * Created by ghassaei on 9/16/16.
 */

// var beamMaterialHighlight = new THREE.LineBasicMaterial({color: 0xff0000, linewidth: 1});
// var beamMaterial = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});
module.exports.Beam = class{
    constructor(nodes, axialStiffness, percentDamping){
        this.type = "beam";
        this.axialStiffness = axialStiffness;
        this.percentDamping = percentDamping;

        nodes[0].addBeam(this);
        nodes[1].addBeam(this);
        this.vertices = [nodes[0]._originalPosition, nodes[1]._originalPosition];
        this.nodes = nodes;

        // var lineGeometry = new THREE.Geometry();
        // lineGeometry.dynamic = true;
        // lineGeometry.vertices = this.vertices;

        // this.object3D = new THREE.Line(lineGeometry, beamMaterial);

        this.originalLength = this.getLength();
    }
    
    // highlight(){
    //     this.object3D.material = beamMaterialHighlight;
    // };
    //
    // unhighlight(){
    //     this.object3D.material = beamMaterial;
    // };

    getLength(){
        return this.getVector().length();
    }

    getOriginalLength(){
        return this.originalLength;
    }

    recalcOriginalLength(){
        this.originalLength = this.getVector().length();
    }

    isFixed(){
        return this.nodes[0].fixed && this.nodes[1].fixed;
    }

    getVector(fromNode){
        if (fromNode == this.nodes[1]) return this.vertices[0].clone().sub(this.vertices[1]);
        return this.vertices[1].clone().sub(this.vertices[0]);
    }

    // setVisibility(state){
    //     this.object3D.visible = state;
    // };

    //dynamic solve

    getK(){
        return this.axialStiffness/this.getLength();
    }

    getD(){
        return this.percentDamping*2*Math.sqrt(this.getK()*this.getMinMass());
    }

    getNaturalFrequency(){
        return Math.sqrt(this.getK()/this.getMinMass());
    }

    getMinMass(){
        var minMass = this.nodes[0].getSimMass();
        if (this.nodes[1].getSimMass()<minMass) minMass = this.nodes[1].getSimMass();
        return minMass;
    }

    getOtherNode(node){
        if (this.nodes[0] == node) return this.nodes[1];
        return this.nodes[0];
    }

    // var valleyColor = new THREE.LineBasicMaterial({color:0x0000ff});
    // var mtnColor = new THREE.LineBasicMaterial({color:0xff0000});

    // setMountain(){
    //     this.object3D.material = mtnColor;
    // };
    //
    // setValley(){
    //     this.object3D.material = valleyColor;
    // };


    //render

    // getObject3D(){
    //     return this.object3D;
    // };

    // render(shouldComputeLineDistance){
    //     this.object3D.geometry.verticesNeedUpdate = true;
    //     this.object3D.geometry.computeBoundingSphere();
    //     if (shouldComputeLineDistance) this.object3D.geometry.computeLineDistances();//for dashed lines
    // };

    //deallocate
    destroy(){
        var self = this;
        _.each(this.nodes, function(node){
            node.removeBeam(self);
        });
        this.vertices = null;
        // this.object3D = null;
        this.nodes = null;
    }
};
