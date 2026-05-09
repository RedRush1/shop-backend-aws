import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import csvParser from 'csv-parser';

const s3 = new S3Client({ region: process.env.REGION });

async function moveFileToParsed(bucket: string, sourceKey: string): Promise<void> {
  const fileName = sourceKey.replace(/^uploaded\//, '');
  const destinationKey = `parsed/${fileName}`;

  console.log(`Copying s3://${bucket}/${sourceKey} → s3://${bucket}/${destinationKey}`);

  await s3.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: destinationKey,
  }));

  console.log(`Deleting source file: s3://${bucket}/${sourceKey}`);

  await s3.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: sourceKey,
  }));

  console.log(`File moved to parsed: ${destinationKey}`);
}

export async function main(event: any) {
  console.log('importFileParser event:', JSON.stringify(event));

  const BUCKET_NAME = process.env.BUCKET_NAME as string;

  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: s3://${BUCKET_NAME}/${key}`);

    const response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    }));

    const stream = response.Body as Readable;

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          console.log('Parsed record:', JSON.stringify(row));
        })
        .on('end', () => {
          console.log(`Finished processing file: ${key}`);
          resolve();
        })
        .on('error', (err: Error) => {
          console.error(`Error parsing file ${key}:`, err);
          reject(err);
        });
    });

    await moveFileToParsed(BUCKET_NAME, key);
  }
}

