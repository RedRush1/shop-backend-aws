import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE as string;
const STOCK_TABLE = process.env.STOCK_TABLE as string;

export async function main(event: any) {
  console.log('getProductsList event:', JSON.stringify(event));

  try {
    const [productsRes, stockRes] = await Promise.all([
      dynamoDB.send(new ScanCommand({ TableName: PRODUCTS_TABLE })),
      dynamoDB.send(new ScanCommand({ TableName: STOCK_TABLE })),
    ]);

    const stockMap = new Map(
      (stockRes.Items ?? []).map(item => [item.product_id.S, Number(item.count.N)])
    );

    const joined = (productsRes.Items ?? []).map(item => ({
      id: item.id.S,
      title: item.title.S,
      description: item.description?.S ?? '',
      price: Number(item.price.N),
      count: stockMap.get(item.id.S!) ?? 0,
    }));

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(joined),
    };
  } catch (error) {
    console.error('getProductsList error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
}
