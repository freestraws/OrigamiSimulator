/**
 * Created by amandaghassaei on 2/25/17.
 */

 module.exports.Crease = class{
     constructor(edge, face1Index, face2Index, targetTheta, type, node1, node2, index){
        //type = 0 panel, 1 crease

        //face1 corresponds to node1, face2 to node2
        this.edge = edge;
        for (var i=0;i<edge.nodes.length;i++){
            edge.nodes[i].addInvCrease(this);
        }
        this.face1Index = face1Index;//todo this is useless
        this.face2Index = face2Index;
        this.targetTheta = targetTheta;
        this.type = type;
        this.node1 = node1;//node at vertex of face 1
        this.node2 = node2;//node at vertex of face 2
        this.index = index;
        node1.addCrease(this);
        node2.addCrease(this);
    }
    
    getLength(){
        return this.edge.getLength();
    }

    getVector(fromNode){
        return this.edge.getVector(fromNode);
    }

    getNormal1Index(){
        return this.face1Index;
    }

    getNormal2Index(){
        return this.face2Index;
    }

    getTargetTheta(){
        return this.targetTheta;
    }

    getK(){
        var length = this.getLength();
        if (this.type == 0) return globals.panelStiffness*length;
        return globals.creaseStiffness*length;
    }

    getD(){
        return globals.percentDamping*2*Math.sqrt(this.getK());
    }

    getIndex(){
        return this.index;
    }

    getLengthToNode1(){
        return this.getLengthTo(this.node1);
    }

    getLengthToNode2(){
        return this.getLengthTo(this.node2);
    }

    getCoef1(edgeNode){
        return this.getCoef(this.node1, edgeNode);
    }

    getCoef2(edgeNode){
        return this.getCoef(this.node2, edgeNode);
    }

    getCoef(node, edgeNode){
        var vector1 = this.getVector(edgeNode);
        var creaseLength = vector1.length();
        vector1.normalize();
        var nodePosition = node.getOriginalPosition();
        var vector2 = nodePosition.sub(edgeNode.getOriginalPosition());
        var projLength = vector1.dot(vector2);
        var length = Math.sqrt(vector2.lengthSq()-projLength*projLength);
        if (length <= 0.0) {
            console.warn("bad moment arm");
            length = 0.001;
        }
        return (1-projLength/creaseLength);
    }

    getLengthTo(node){
        var vector1 = this.getVector().normalize();
        var nodePosition = node.getOriginalPosition();
        var vector2 = nodePosition.sub(this.edge.nodes[1].getOriginalPosition());
        var projLength = vector1.dot(vector2);
        var length = Math.sqrt(vector2.lengthSq()-projLength*projLength);
        if (length <= 0.0) {
            console.warn("bad moment arm");
            length = 0.001;
        }
        return length;
    }

    getNodeIndex(node){
        if (node == this.node1) return 1;
        else if (node == this.node2) return 2;
        else if (node == this.edge.nodes[0]) return 3;
        else if (node == this.edge.nodes[1]) return 4;
        console.log("unknown node type");
        return 0;
    }

    setVisibility(){
        var vis = false;
        if (this.type==0) vis = globals.panelsVisible;
        else {
            vis = (this.targetTheta>0 && globals.mtnsVisible) || (this.targetTheta<0 && globals.valleysVisible);
        }
        this.edge.setVisibility(vis);
    }

    destroy(){
        this.node1.removeCrease(this);
        this.node2.removeCrease(this);
        if (this.edge && this.edge.nodes){
            for (var i=0;i<this.edge.nodes.length;i++){
                this.edge.nodes[i].removeInvCrease(this);
            }
        }
        this.edge = null;
        this.face1Index = null;
        this.face2Index = null;
        this.targetTheta = null;
        this.type = null;
        this.node1 = null;
        this.node2 = null;
        this.index = null;
    }
};
