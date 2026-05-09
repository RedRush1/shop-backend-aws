import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import * as AWS from 'aws-sdk';
import { randomUUID as uuidv4 } from 'crypto';

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const sns = new AWS.SNS({ region: process.env.AWS_REGION });

export async function main(event: SQSEvent) {
  const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE as string;
  const STOCK_TABLE = process.env.STOCK_TABLE as string;
  const CREATE_PRODUCT_TOPIC_ARN = process.env.CREATE_PRODUCT_TOPIC_ARN as string;

  console.log('catalogBatchProcess event:', JSON.stringify(event));

  for (const record of event.Records) {
    const { title, description, price, count } = JSON.parse(record.body);
    const id = uuidv4();
    const safeCount = count ?? 0;

    await dynamoDB.send(new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName: PRODUCTS_TABLE,
            Item: {
              id:          { S: id },
              title:       { S: title.trim() },
              description: { S: description ?? '' },
              price:       { N: price.toString() },
            },
          },
        },
        {
          Put: {
            TableName: STOCK_TABLE,
            Item: {
              product_id: { S: id },
              count:      { N: safeCount.toString() },
            },
          },
        },
      ],
    }));

    await sns.publish({
      TopicArn: CREATE_PRODUCT_TOPIC_ARN,
      Subject: 'New product created',
      Message: JSON.stringify({ id, title, description, price, count: safeCount }),
      MessageAttributes: {
        price: {
          DataType: 'Number',
          StringValue: price.toString(),
        },
      },
    }).promise();

    console.log('Created product:', { id, title, description, price, count: safeCount });
  }
}
