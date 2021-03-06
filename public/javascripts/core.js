// Global vars
var canvas;
var engine;
var camera;
var scene;
var skyboxMaterial;
var scene;
var particleSystem;
var weather = "";
var lastWeather = "";

// Create our environment
function createScene() {
    scene = new BABYLON.Scene(engine);

    var light = new BABYLON.PointLight("Omni", new BABYLON.Vector3(10, 50, 50), scene);
    camera = new BABYLON.ArcRotateCamera("Camera", 0.4, 1.2, 20, new BABYLON.Vector3(-10, 0, 0), scene);
    x = camera.position.x;
    //camera.attachControl(canvas, true); // If uncommented the user will be able to move camera

    // Ground is mapped from heightmap, then covered with a grass texture
    var ground = BABYLON.Mesh.CreateGroundFromHeightMap("ground", "images/heightMap/Heightmap.jpg", 100, 100, 100, 0, 10, scene, false);
    var groundMaterial = new BABYLON.StandardMaterial("ground", scene);
    groundMaterial.diffuseTexture = new BABYLON.Texture("images/textures/grass_texture.jpg", scene);
    groundMaterial.diffuseTexture.uScale = 6;
    groundMaterial.diffuseTexture.vScale = 6;
    groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    ground.position.y = -10;
    ground.material = groundMaterial;
    ground.receiveShadows = true;

    // Fog gives a nice ambiance
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogColor = new BABYLON.Color3(0.9, 0.9, 0.85);
    scene.fogDensity = 0.01;
    scene.fogStart = 27.0;
    scene.fogEnd = 90.0;

    // Skybox is a box with texture inside to give a 'world' feel
    var skybox = BABYLON.Mesh.CreateBox("skyBox", 100.0, scene);
    skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("images/textures/skybox", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    //The billboard
    outputplane = BABYLON.Mesh.CreatePlane("outputplane", 25, scene, false);
    outputplane.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
    outputplane.material = new BABYLON.StandardMaterial("outputplane", scene);
    outputplane.position = new BABYLON.Vector3(-25, -5, -25);
    outputplane.scaling.y = 0.4;

    outputplaneTexture = new BABYLON.DynamicTexture("dynamic texture", 412, scene, true);
    outputplane.material.diffuseTexture = outputplaneTexture;
    outputplane.material.specularColor = new BABYLON.Color3(0, 0, 0);
    outputplane.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
    outputplane.material.backFaceCulling = false;

    context2D = outputplaneTexture.getContext();

    return scene;
};


// The update method, used for updating camera etc.
var x = 0;
var counterForX = 0;
var reduce = false;
var lastRenderTime = 0;
var beforeRender = function () {
    // Move camera for that good 3D feel
    if (camera.alpha >= 0.6) reduce = true;
    if (camera.alpha <= 0.4) reduce = false;
    if (reduce) camera.alpha -= 0.0002;
    if (!reduce) camera.alpha += 0.0002;

    // Get the current time
    var d = new Date();
    var timeNow = d.getTime();

    // Dont update more than every 10 seconds unless first time
    if (timeNow - lastRenderTime > 10000 || lastRenderTime == 0) {
        lastRenderTime = timeNow;
        // Update the text
        getXMLthruVariousHoops();
        out("Current forecast:", weather);

        // Dont update the entire system more than needed
        if (weather != lastWeather) {
            updateSystem();
            lastWeather = weather;
        }
    }
};

// Resize event
window.addEventListener("resize", function () {
    engine.resize();
});

// Sets weather to the billboard
var out = function (data, data2) {
    context2D.clearRect(0, 0, 512, 512); // clear from(0,0) to (512,512)
    outputplaneTexture.drawText(data, null, 80, "40px verdana", "white", null);
    outputplaneTexture.drawText(data2, null, 160, "40px verdana", "white", null);
};

// Particle system used for displaying raindrops
function setupParticleSystem(emitter) {
    // Create a particle system
    particleSystem = new BABYLON.ParticleSystem("particles", 2000, scene);

    //Texture of each particle
    particleSystem.particleTexture = new BABYLON.Texture("images/textures/raindrop2.gif", scene);

    // Where the particles come from
    particleSystem.emitter = emitter; // the starting object, the emitter
    particleSystem.minEmitBox = new BABYLON.Vector3(-1, 0, 0); // Starting all from
    particleSystem.maxEmitBox = new BABYLON.Vector3(1, 0, 0); // To...

    // Colors of all particles
    particleSystem.color1 = new BABYLON.Color4(0.7, 0.8, 1.0, 1.0);
    particleSystem.color2 = new BABYLON.Color4(0.2, 0.5, 1.0, 1.0);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0.2, 0.0);

    // Size of each particle (random between...
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.5;

    // Life time of each particle (random between...
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 1.5;

    // Emission rate
    particleSystem.emitRate = 15;

    // Blend mode : BLENDMODE_ONEONE, or BLENDMODE_STANDARD
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

    // Set the gravity of all particles
    particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

    // Direction of each particle after it has been emitted
    particleSystem.direction1 = new BABYLON.Vector3(-7, -8, 3);
    particleSystem.direction2 = new BABYLON.Vector3(7, -8, -3);

    // Angular speed, in radians
    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = 0;//Math.PI;

    // Speed
    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.3;
    particleSystem.updateSpeed = 0.005;

    // Start the particle system
    particleSystem.start();
}

// Updates clouds, sun and rain according to forecast text
var box = [];
var sun;
function updateSystem()
{
    for (x = 0; x < 10; x++) {
        if (box[x] != null) box[x].dispose();
    }
    if (sun != null) sun.dispose();

    if (weather == "Cloudy" || weather== "Rain" || weather== "Heavy rain") {
        var material1 = new BABYLON.StandardMaterial("mat1", scene);
        material1.diffuseColor = new BABYLON.Color3(0, 0, 0); // black clouds
        material1.specularColor = new BABYLON.Color3(1, 1, 1);
        material1.specularPower = 10;
    }
    if (weather == "Partly cloudy") {
        var material1 = new BABYLON.StandardMaterial("mat1", scene);
        material1.diffuseColor = new BABYLON.Color3(1, 1, 1); // white clouds
        material1.specularColor = new BABYLON.Color3(1, 1, 1);
        material1.specularPower = 10;
    }

    if (weather == "Partly cloudy" || weather == "Cloudy" || weather == "Rain" || weather == "Heavy rain") {
        // boxes simulate clouds
        for (var i = 0; i < 10; i++) {
            if (i <= 5) {
                box[i] = BABYLON.Mesh.CreateBox("Box", 1.0 * i + 0.5, scene);
                box[i].material = material1;
                box[i].position = new BABYLON.Vector3(-i * 5 - 10, 3, 0);
                if (weather == "Rain" || weather == "Heavy rain") setupParticleSystem(box[i]); // Add raindrops if it's raining
            }
        }
    }
    if (weather == "Clear sky" || weather == "Fair") {
        // No clouds, no rain. That means it's Clear sky!
        var material1 = new BABYLON.StandardMaterial("mat1", scene);
        material1.diffuseColor = new BABYLON.Color3(1, 1, 0);
        material1.specularColor = new BABYLON.Color3(1, 1, 0);
        material1.specularPower = 100;
        material1.emissiveColor = new BABYLON.Color3(1, 1, 0);
        sun = BABYLON.Mesh.CreateSphere("sun", 90.0, 5.0, scene);
        sun.material = material1;
        sun.position = new BABYLON.Vector3(-10, 3, 0);
    }
}

// This is where the weather data comes from (currently for the city Skien in Norway, via yr.no)
function getXMLthruVariousHoops() {
    // The site where the XML lies
    site = 'http://www.yr.no/place/Norge/Telemark/Skien/Skien/forecast_hour_by_hour.xml';

    // YQL, our handy JSON proxy
    var yql = 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent('select * from xml where url="' + site + '"') + '&format=xml&callback=?';

    // Request that YSQL string, and run a callback function.
    // Pass a defined function to prevent cache-busting.
    $.getJSON(yql, function (data) {
        getcurrentweatherRightNow(data.results[0]);
    });
}

function getcurrentweatherRightNow(xml) {
    // example xml, the city Skien in Norway
    //http://www.yr.no/place/Norge/Telemark/Skien/Skien/forecast_hour_by_hour.xml
    // Move to the right part of the document, wich is the tabular field
    $(xml).find("tabular").each(function () {
        //Then find the time tag and print the 'from' attribute
        $(this).find("time").each(function () {
            // Get current date/time in right format
            var currentdate = new Date();
            var year = currentdate.getFullYear();
            var month = (currentdate.getMonth() + 1); // JS starts from 0 for unobvious reasons
            if (month.toString().length == 1) month = '0' + month; // toFixed 2 'decimals'
            var date = currentdate.getDate();
            if (date.toString().length == 1) date = '0' + date;
            var hours = currentdate.getHours();
            hours += 1; // for this experiment we just want the forecast for the next hour
            if (hours.toString().length == 1) hours = '0' + hours;

            var dateTimeT = year + "-" + month + "-" + date + "T" + hours;

            // full string is like this in the XML: 2015-05-17T01:00:00 but only changes down to the hour
            // therefore our test string is like this: 2015-05-17T01

            // Get the XML time
            var xmlDate = $(this).attr("from");

            //~ is bitwise inverter. indexOf returns 0 if string was found, and so this makes sense
            if (~xmlDate.indexOf(dateTimeT)) {
                // This is current forecast
                $(this).find("symbol").each(function () {
                    weather= $(this).attr("name");
                });
            }
        });
    });
}

window.onload = function() {
    // Setup scene
    canvas = document.getElementById("renderCanvas");
    engine = new BABYLON.Engine(canvas, true);
    scene = createScene();
    scene.beforeRender = beforeRender;

    // Runs the rendering
    engine.runRenderLoop(function () {
        scene.render();
    });
};
