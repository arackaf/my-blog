const path = require("path");
const glob = require("glob");
const sharp = require("sharp");

const args = process.argv;
const imgDir = args.at(-1);

const globPath = path.join(process.cwd(), "public", imgDir) + "/**/*";

const allImages = glob.sync(globPath);

async function run() {
  for (let img of allImages) {
    const sharpImage = sharp(img);
    const dimensions = await sharpImage.metadata();

    if (dimensions.width <= 600) {
      console.log("Skipping", img);
      continue;
    }
    const ext = path.extname(img);
    const dir = path.dirname(img);
    const basename = path.basename(img, ext);

    const newName = path.join(dir, basename + "-sized" + ext);

    console.log("Creating", newName);
    await sharpImage.resize(600).toFile(newName);
  }
}

run();
