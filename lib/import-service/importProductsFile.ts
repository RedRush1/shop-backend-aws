import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.REGION });

export async function main(event: any) {
  console.log('importProductsFile event:', JSON.stringify(event));

  const BUCKET_NAME = process.env.BUCKET_NAME as string;
  const fileName = event.queryStringParameters?.name;

  if (!fileName) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'Missing required query parameter: name' }),
    };
  }

  try {
    const key = `uploaded/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: 'text/csv',
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: signedUrl }),
    };
  } catch (error) {
    console.error('importProductsFile error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}

