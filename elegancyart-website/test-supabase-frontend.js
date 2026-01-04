// test-supabase-frontend.js
const SUPABASE_URL = 'https://thyfcodrqqwjvqdrhnex.supabase.co'
const ANON_KEY = 'sb_publishable_Rgpt00AV1Nl-tFBMNwTi6A_gBJJpCtU'

async function test() {
    console.log('📍 Testing Supabase connection from Node.js...')
    console.log('URL:', SUPABASE_URL)
    console.log('Anon Key (first 20 chars):', ANON_KEY.substring(0, 20))

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`
            }
        })
        console.log('Status:', response.status)

        if (response.status === 200) {
            const data = await response.json()
            console.log('✅ SUCCESS! Found', data.length, 'products')
            console.log('First product:', data[0].name)
        } else if (response.status === 401) {
            console.log('❌ UNAUTHORIZED: Wrong API key')
        } else if (response.status === 404) {
            console.log('❌ NOT FOUND: Table might not exist')
        } else {
            console.log('❌ ERROR:', response.status, response.statusText)
        }
    } catch (error) {
        console.log('❌ NETWORK ERROR:', error.message)
    }
}

test()