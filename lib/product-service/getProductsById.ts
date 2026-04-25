import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE as string;
const STOCK_TABLE = process.env.STOCK_TABLE as string;

export async function main(event: any) {
  console.log('getProductsById event:', JSON.stringify(event));

  const productId = event.pathParameters?.productId;

  if (!productId) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'productId is required' }),
    };
  }

  try {
    const [productRes, stockRes] = await Promise.all([
      dynamoDB.send(new GetItemCommand({ TableName: PRODUCTS_TABLE, Key: { id: { S: productId } } })),
      dynamoDB.send(new GetItemCommand({ TableName: STOCK_TABLE, Key: { product_id: { S: productId } } })),
    ]);

    if (!productRes.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Product with id "${productId}" not found` }),
      };
    }

    const item = productRes.Item;
    const product = {
      id: item.id.S,
      title: item.title.S,
      description: item.description?.S ?? '',
      price: Number(item.price.N),
      count: stockRes.Item ? Number(stockRes.Item.count.N) : 0,
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error('getProductsById error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
