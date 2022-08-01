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

    const MAX_WIDTH = 1000;
    if (dimensions.width <= MAX_WIDTH) {
      console.log("Skipping", img);
      continue;
    }
    const ext = path.extname(img);
    const dir = path.dirname(img);
    const basename = path.basename(img, ext);

    if (basename.endsWith("-sized")) {
      continue;
    }

    const newName = path.join(dir, basename + "-sized" + ext);

    console.log("Creating", newName);
    await sharpImage.resize(MAX_WIDTH).toFile(newName);
  }
}

run();
