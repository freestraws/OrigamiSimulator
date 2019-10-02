/**
 * Created by ghassaei on 9/16/16.
 * nodified by freestraws on 10/1/2019
 */
import { simulationRunning, vrEnabled, vive, capturer, threeView, screenRecordFilename, shouldScaleCanvas, shouldAnimateFoldPercent, capturerFrames, currentFPS, rotateModel, rotationSpeed, needsSync, simNeedsSync, capturerScale, backgroundColor } from "./globals";
import { Scene, Object3D, PerspectiveCamera, WebGLRenderer, Color, DirectionalLight, TrackballControls, Vector3 } from "three";

export default threeView = class {
    constructor(){
        this.scene = new Scene();
        this.modelWrapper = new Object3D();

        this.camera = new PerspectiveCamera(60, this.window.innerWidth/this.window.innerHeight, 0.1, 500);
        this.renderer = new WebGLRenderer({antialias: true});
        // var svgRenderer = new THREE.SVGRenderer();
        var container = $("#threeContainer");
        this.renderer.setPixelRatio(this.window.devicePixelRatio);
        this.renderer.setSize(this.window.innerWidth, this.window.innerHeight);
        this.container.append(this.renderer.domElement);

        this.scene.background = new Color(0xffffff);//new THREE.Color(0xe6e6e6);
        this.setBackgroundColor();
        this.scene.add(this.modelWrapper);
        this.directionalLight1 = new DirectionalLight(0xffffff, 0.8);
        this.directionalLight1.position.set(0, 100, 0);
        this.scene.add(this.directionalLight1);
        this.directionalLight4 = new DirectionalLight(0xffffff, 0.3);
        this.directionalLight4.position.set(0, -100, 0);
        this.scene.add(this.directionalLight4);
        this.directionalLight2 = new DirectionalLight(0xffffff, 0.8);
        this.directionalLight2.position.set(100, -30, 0);
        this.scene.add(this.directionalLight2);
        this.directionalLight3 = new DirectionalLight(0xffffff, 0.8);
        this.directionalLight3.position.set(-100, -30, 0);
        this.scene.add(this.directionalLight3);
        this.directionalLight4 = new DirectionalLight(0xffffff, 0.3);
        this.directionalLight4.position.set(0, 30, 100);
        this.scene.add(this.directionalLight4);
        this.directionalLight5 = new DirectionalLight(0xffffff, 0.3);
        this.directionalLight5.position.set(0, 30, -100);
        this.scene.add(this.directionalLight5);
        // var ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        // scene.add(ambientLight);
        //scene.fog = new THREE.FogExp2(0xf4f4f4, 1.7);
        //renderer.setClearColor(scene.fog.color);

        this.scene.add(this.camera);

        this.resetCamera();

        this.controls = new TrackballControls(this.camera, this.renderer.domElement);
        this.controls.rotateSpeed = 4.0;
        this.controls.zoomSpeed = 15;
        this.controls.noPan = true;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;
        this.controls.minDistance = 1;
        this.controls.maxDistance = 30;
        // controls.addEventListener("change", render);

        this._render();//render before model loads
    }

    resetCamera(){
        this.camera.zoom = 7;
        this.camera.updateProjectionMatrix();
        this.camera.position.x = 5;
        this.camera.position.y = 5;
        this.camera.position.z = 5;
        if (this.controls) this.setCameraIso();
    }

    setCameraX(sign){
        this.controls.reset(new Vector3(sign,0,0));
    }
    setCameraY(sign){
        this.controls.reset(new Vector3(0,sign,0));
    }
    setCameraZ(sign){
        this.controls.reset(new Vector3(0,0,sign));
    }
    setCameraIso(){
        this.controls.reset(new Vector3(1,1,1));
    }

    startAnimation(){
        console.log("starting animation");
        this.renderer.animate(_loop);
    }

    pauseSimulation(){
        simulationRunning = false;
        console.log("pausing simulation");
    }

    startSimulation(){
        console.log("starting simulation");
        simulationRunning = true;
    }

    //var captureStats = $("#stopRecord>span");
    _render(){
        if (vrEnabled){
            vive.render();
            return;
        }
        this.renderer.render(this.scene, this.camera);
        if (this.config.capturer.capturer) {
            if (this.config.capturer.capturer == "png"){
                var canvas = threeView.renderer.domElement;
                canvas.toBlob(function(blob) {
                    saveAs(blob, screenRecordFilename + ".png");
                }, "image/png");
                this.config.capturer.capturer = null;
                shouldScaleCanvas = false;
                shouldAnimateFoldPercent = false;
                threeView.onWindowResize();
                return;
            }
            captureStats.html("( " + this.config.capturer.capturerFrames + " frames  at " + this.config.capturer.currentFPS  + "fps )");
            this.config.capturer.capturer.capture(this.renderer.domElement);
        }
    }

    _loop(){
        if (this.config.rotate.rotateModel !== null){
            if (this.config.rotate.rotateModel == "x") this.modelWrapper.rotateX(this.config.rotate.rotationSpeed);
            if (this.config.rotate.rotateModel == "y") this.modelWrapper.rotateY(this.config.rotate.rotationSpeed);
            if (this.config.rotate.rotateModel == "z") this.modelWrapper.rotateZ(this.config.rotate.rotationSpeed);
        }
        if (needsSync){
            this.model.sync();
        }
        if (simNeedsSync){
            this.model.syncSolver();
        }
        if (simulationRunning) this.model.step();
        if (this.config.toggles.vrEnabled){
            this._render();
            return;
        }
        this.controls.update();
        this._render();
    }

    sceneAddModel(object){
        this.modelWrapper.add(object);
    }

    onWindowResize(){

        if (vrEnabled){
            console.warn("Can't resize window when in VR mode.");
            return;
        }

        this.camera.aspect = this.window.innerWidth / this.window.innerHeight;
        // this.camera.left = -this.window.innerWidth / 2;
        // this.camera.right = this.window.innerWidth / 2;
        // this.camera.top = this.window.innerHeight / 2;
        // this.camera.bottom = -this.window.innerHeight / 2;
        this.camera.updateProjectionMatrix();

        var scale = 1;
        if (shouldScaleCanvas) scale = this.config.capturer.capturerScale;
        this.renderer.setSize(scale*this.window.innerWidth, scale*this.window.innerHeight);
        this.controls.handleResize();
    }

    enableControls(state){
        this.controls.enabled = state;
        this.controls.enableRotate = state;
    }

    resetModel(){
        this.modelWrapper.rotation.set(0,0,0);
    }

    setBackgroundColor(color){
        if (color === undefined) color = this.config.backgroundColor;
        this.scene.background.setStyle( "#" + color);
    }
}