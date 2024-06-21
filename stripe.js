if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
  }

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.SK_TEST);

  
  router.post('/create-checkout-session', async (req, res) => {

    if(!req.body.cartItems){
        console.log('Not Ready');
        return;
    }

    const line_items = req.body.cartItems.map((item) => {
        console.log(`${process.env.CLIENT_URL}/uploads/${item.image_urls[0]}`);
        return{
                price_data: {
                currency: 'eur',
                product_data: {
                name: item.nome,
                images: [`https://my-ecommerce-frontend-chi.vercel.app/uploads/${item.image_urls[0]}`, `https://my-ecommerce-frontend-chi.vercel.app/uploads/${item.image_urls[1]}`],
                description: item.descrizione,
                metadata: {
                    id: item.carrello_id
                }
                },
                unit_amount: Number(item.prezzo) * 100,
            },
            quantity: item.quantita,
            }
        }
    );

  console.log(line_items)

    const session = await stripe.checkout.sessions.create({

    shipping_address_collection: {
    allowed_countries: ['IT', 'AT', 'CH', 'FR', 'DE', 'ES', 'GB', 'NL', 'BE', 'PT', 'SE',]
        },
        shipping_options: [
            {
            shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: {
                amount: 0,
                currency: 'eur',
                },
                display_name: 'Free shipping',
                delivery_estimate: {
                minimum: {
                    unit: 'business_day',
                    value: 5,
                },
                maximum: {
                    unit: 'business_day',
                    value: 7,
                },
                },
            },
            },
            {
            shipping_rate_data: {
                type: 'fixed_amount',
                fixed_amount: {
                amount: 1500,
                currency: 'eur',
                },
                display_name: 'Next day air',
                delivery_estimate: {
                minimum: {
                    unit: 'business_day',
                    value: 1,
                },
                maximum: {
                    unit: 'business_day',
                    value: 3,
                },
                },
            },
            },
        ],
      line_items,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/payment/checkout-success`,
      cancel_url: `${process.env.CLIENT_URL}/payment`,
    });
  
    console.log('successo!')
    res.send({ url: session.url });
  });
  
  module.exports = router