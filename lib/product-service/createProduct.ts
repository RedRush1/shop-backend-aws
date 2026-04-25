import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
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

  try {
    const id = uuidv4();

    await dynamoDB.send(new PutItemCommand({
      TableName: PRODUCTS_TABLE,
      Item: {
        id:          { S: id },
        title:       { S: title.trim() },
        description: { S: description ?? '' },
        price:       { N: price.toString() },
      },
    }));

    await dynamoDB.send(new PutItemCommand({
      TableName: STOCK_TABLE,
      Item: {
        product_id: { S: id },
        count:      { N: (count ?? 0).toString() },
      },
    }));

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, title: title.trim(), description: description ?? '', price, count: count ?? 0 }),
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

