const path = require("path");
const glob = require("glob");
const sharp = require("sharp");

const args = process.argv;
const imgDir = args.at(-1);

const globPath = path.join(process.cwd(), "public", imgDir) + "/**/*";

const allImages = glob.sync(globPath);

const PREVIEW_WIDTH = 300;

async function run() {
  for (let img of allImages) {
    const sharpImage = sharp(img);
    const dimensions = await sharpImage.metadata();

    const ext = path.extname(img);
    const dir = path.dirname(img);
    const basename = path.basename(img, ext);

    if (/-preview$/.test(basename)) {
      continue;
    }

    const MAX_WIDTH = 1000;
    if (dimensions.width <= MAX_WIDTH) {
      console.log("Skipping", img);
      const previewName = path.join(dir, basename + "-preview" + ext);
      if (dimensions.width > PREVIEW_WIDTH) {
        await sharpImage.resize(PREVIEW_WIDTH).toFile(previewName);
      }
      continue;
    }

    if (basename.endsWith("-sized")) {
      continue;
    }

    const newName = path.join(dir, basename + "-sized" + ext);

    console.log("Creating", newName);
    await sharpImage.resize(MAX_WIDTH).toFile(newName);

    const previewName = path.join(dir, basename + "-sized-preview" + ext);
    if (dimensions.width > PREVIEW_WIDTH) {
      await sharpImage.resize(PREVIEW_WIDTH).toFile(previewName);
    }
  }
}

run();
