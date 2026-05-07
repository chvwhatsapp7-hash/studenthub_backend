import AWS from "aws-sdk";

const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
});

export const uploadToSpaces = async (fileBuffer, fileName, mimeType) => {
  const params = {
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: `studenthub/${Date.now()}-${fileName}`,
    Body: fileBuffer,
    ACL: "public-read",
    ContentType: mimeType,
  };

  const data = await s3.upload(params).promise();

  return data.Location;
};