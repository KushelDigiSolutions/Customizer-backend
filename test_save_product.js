const axios = require('axios');

async function testSaveProduct() {
  try {
    console.log('🧪 Testing /api/save-product endpoint...\n');

    // Test data - any JSON structure
    const testProduct = {
      productName: "Test Custom T-Shirt",
      productSku: "TSHIRT_TEST_001",
      productType: "2d",
      productImage: "https://example.com/test-image.jpg",
      tabSettings: {
        aiEditor: true,
        imageEdit: true,
        textEdit: true,
        colors: true,
        clipart: true
      },
      customizableData: [
        {
          title: "Test Design 1",
          shortDescription: "This is a test design",
          price: 29.99,
          files: ["https://example.com/design1.jpg"]
        }
      ],
      layerDesign: {
        "default": [
          {
            title: "Default Design",
            shortDescription: "Default design for testing",
            price: 0.0,
            files: ["https://example.com/default.jpg"]
          }
        ]
      },
      storeHash: "test_store_123",
      userId: 1,
      customField: "Any additional data",
      nestedObject: {
        level1: {
          level2: "Deep nested data"
        }
      }
    };

    console.log('📤 Sending test data:');
    console.log(JSON.stringify(testProduct, null, 2));
    console.log('\n' + '='.repeat(50) + '\n');

    // Make API call
    const response = await axios.post('http://localhost:5000/api/save-product', testProduct, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Error Response:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test duplicate SKU
async function testDuplicateSku() {
  try {
    console.log('\n🧪 Testing duplicate SKU...\n');

    const duplicateProduct = {
      productName: "Duplicate Product",
      productSku: "TSHIRT_TEST_001", // Same SKU as above
      productType: "2d",
      productImage: "https://example.com/duplicate.jpg",
      tabSettings: {
        aiEditor: true,
        imageEdit: true,
        textEdit: true,
        colors: true,
        clipart: true
      },
      customizableData: [],
      layerDesign: {},
      storeHash: "test_store_456",
      userId: 2,
      customField: "Duplicate data"
    };

    console.log('📤 Sending duplicate SKU data...');

    const response = await axios.post('http://localhost:5000/api/save-product', duplicateProduct, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Unexpected Success (should have failed):');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Expected Error (duplicate SKU):');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Test missing required fields
async function testMissingFields() {
  try {
    console.log('\n🧪 Testing missing required fields...\n');

    const invalidProduct = {
      productType: "2d",
      productImage: "https://example.com/invalid.jpg"
      // Missing productName and productSku
    };

    console.log('📤 Sending invalid data (missing required fields)...');

    const response = await axios.post('http://localhost:5000/api/save-product', invalidProduct, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Unexpected Success (should have failed):');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('❌ Expected Error (missing required fields):');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

// Run all tests
async function runAllTests() {
  await testSaveProduct();
  await testDuplicateSku();
  await testMissingFields();
  
  console.log('\n🎉 All tests completed!');
}

runAllTests();
