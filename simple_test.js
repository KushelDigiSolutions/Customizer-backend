const axios = require('axios');

async function testSaveProduct() {
  try {
    console.log('🧪 Testing /api/save-product endpoint...\n');

    // Simple test data
    const testData = {
      productName: "Simple Test Product",
      productSku: "SIMPLE_001",
      anyField: "Any value",
      nestedData: {
        key: "value"
      }
    };

    console.log('📤 Sending data:', JSON.stringify(testData, null, 2));

    const response = await axios.post('http://localhost:5000/api/save-product', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Error:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

testSaveProduct();
