const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();

const sanitizeHTML = require("sanitize-html");
const fse = require("fs-extra");
const sharp = require("sharp");


const path = require("path");

const React = require('react');
const ReactDOMServer = require('react-dom/server');
const AnimalCard = require("./src/components/AnimalCard").default;

//when application launches make sure public/uploaded-photos folder exists
fse.ensureDirSync(path.join("public", "uploaded-photos"));

const multer = require("multer");
//const storage = multer.memoryStorage();
//const upload = multer({ storage: storage });
const upload = multer();

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.static("public"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(cors());

mongoose
  .connect("mongodb://localhost:27017/animalmern")
  .catch((err) => console.log(err));

//DB SCHEMA AND MODEL
const animalSchema = mongoose.Schema({
  name: String,
  species: String,
  // fileName: {
  //   type: String,
  //   required: true,
  // },
  // file: {
  //   data: Buffer,
  //   contentType: String,
  // },
  // uploadTime: {
  //   type: Date,
  //   default: Date.now,
  // },
});

const Animal = mongoose.model("Animal", animalSchema);

function ourCleanup(req, res, next) {
  if (typeof req.body.name != "string") req.body.name = "";
  if (typeof req.body.species != "string") req.body.species = "";
  if (typeof req.body._id != "string") req.body._id = "";

  req.cleanData = {
    name: sanitizeHTML(req.body.name.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    species: sanitizeHTML(req.body.species.trim(), {
      allowedTags: [],
      allowedAttributes: {},
    }),
    // file: {
    //   data: req.file.buffer,
    //   contentType: req.file.mimetype
    // },
    // fileName: req.body.fileName
  };
  next();
}

function passwordProtected(req, res, next) {
  res.set("WWW-Authenticate", "Basic realm='Animal MERN app'");
  if (req.headers.authorization === "Basic YWRtaW46YWRtaW4=") {
    next();
  } else {
    console.log(req.headers.authorization);
    res.status(401).send("Try Again");
  }
}

app.get("/", async (req, res) => {
  const animals = await Animal.collection.find().toArray()
  const generatedHTML = ReactDOMServer.renderToString(
        <div className="container">
          <div className="animal-grid mb-3">
            {animals.map(animal=> <AnimalCard key={animal._id} name={animal.name} species={animal.species} photo={animal.photo} id={animal._id} readOnly={true} />)}
          </div>
          <p><a href="/admin">Login / manage the animal listings </a></p>
        </div>
      )
      res.render("home", { generatedHTML })
  });

app.use(passwordProtected);

app.get("/admin", (req, res) => {
  res.render("admin");
});

app.get("/api/animals", async (req, res) => {
  await Animal.find()
    .then((animals) => {
      console.log(animals);
      res.json(animals);
    })
    .catch((err) => console.log(err));
});

//const animalObjectId = mongoose.Types.ObjectId(animalId);
app.post(
  "/create-animal",
  upload.single("photo"),
  ourCleanup,
  async (req, res) => {
    if (req.file) {
      const photoFileName = `${Date.now()}.jpg`;
      await sharp(req.file.buffer)
        .resize(844, 456)
        .jpeg({ quality: 60 })
        .toFile(path.join("public", "uploaded-photos", photoFileName));
      req.cleanData.photo = photoFileName;
    }

    const info = await Animal.collection.insertOne(req.cleanData);
    const newAnimal = await Animal.collection.findOne({
      _id: mongoose.Types.ObjectId(info.insertedId),
    });
    res.send(newAnimal);
  }
);

app.delete("/animal/:id", async (req, res) => {
  if (typeof req.params.id != "string") req.params.id = "";
  const doc = await Animal.collection.findOne({ _id: mongoose.Types.ObjectId(req.params.id)})
  if (doc.photo) {
    fse.remove(path.join("public", "uploaded-photos", doc.photo));
  }
  Animal.collection.deleteOne({ _id: mongoose.Types.ObjectId(req.params.id) });
  res.send("Deletion complete");
});

app.post("/update-animal", upload.single("photo"), ourCleanup, async (req,res) => {
  if (req.file)  {
    //if uploading a new photo
    const photoFileName = `${Date.now()}.jpg`;
    await sharp(req.file.buffer)
      .resize(844, 456)
      .jpeg({ quality: 60 })
      .toFile(path.join("public", "uploaded-photos", photoFileName));
    req.cleanData.photo = photoFileName;
    //want to delete previous old photo from directory 
    const info = await Animal.collection.findOneAndUpdate({_id: mongoose.Types.ObjectId(req.body._id) }, {$set: req.cleanData})
    if (info.value.photo) {
      fse.remove(path.join("public", "uploaded-photos", info.value.photo));
    }
    res.send(photoFileName);
  } else {
    Animal.collection.findOneAndUpdate({_id: mongoose.Types.ObjectId(req.body._id) }, {$set: req.cleanData})
    res.send(false);
  }
})

app.listen(8000);
