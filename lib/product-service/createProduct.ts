import { DynamoDBClient, TransactWriteItemsCommand } from '@aws-sdk/client-dynamodb';
import { randomUUID as uuidv4 } from 'crypto';

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE as string;
const STOCK_TABLE = process.env.STOCK_TABLE as string;

export async function main(event: any) {
  console.log('createProduct event:', JSON.stringify(event));

  let body: any;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Invalid JSON body' }),
    };
  }

  const { title, description, price, count } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'title must be a non-empty string' }),
    };
  }

  if (typeof price !== 'number' || price < 0) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'price must be a non-negative number' }),
    };
  }

  if (count !== undefined && (typeof count !== 'number' || !Number.isInteger(count) || count < 0)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'count must be a non-negative integer' }),
    };
  }

  try {
    const id = uuidv4();
    const safeCount = count ?? 0;

    // Transactional write: both product and stock are created atomically.
    // If either write fails, neither record is saved.
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

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        title: title.trim(),
        description: description ?? '',
        price,
        count: safeCount,
      }),
    };
  } catch (error) {
    console.error('createProduct error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
