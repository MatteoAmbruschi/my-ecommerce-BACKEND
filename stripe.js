if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
  }

const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.SK_TEST);
const db = require('./queries')

  
  router.post('/create-checkout-session', async (req, res) => {

    if(!req.body.cartItems){
        console.log('Not Ready');
        return;
    }

    const customer = await stripe.customers.create({
        metadata: {
            cart: JSON.stringify(req.body.cartItems.map((item) => item.carrello_id))
        }
    })

    const line_items = req.body.cartItems.map((item) => {
        console.log(`${process.env.CLIENT_URL}/uploads/${item.image_urls[0]}`);
        return{
                price_data: {
                currency: 'eur',
                product_data: {
                name: item.nome,
                images: [`https://my-ecommerce-frontend-chi.vercel.app/uploads/${item.image_urls[0]}`, `https://my-ecommerce-frontend-chi.vercel.app/uploads/${item.image_urls[1]}`],
                description: `${item.descrizione}, size: ${item.taglia_selezionata}`,
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
      customer: customer.id,
      line_items,
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/payment/checkout-success`,
      cancel_url: `${process.env.CLIENT_URL}/payment`,
    });
  
    console.log('successo!')
    res.send({ url: session.url });
  });




  // Stripe webhook

// This is your Stripe CLI webhook secret for testing your endpoint locally.
/* endpointSecret = 'whsec_m9utAEusS6p0ZbbJu1L41nj8442V1DYX' */
const endpointSecret = process.env.STRIPE_SECRET;

router.post('/webhook', express.raw({ type: 'application/json' }), (request, response) => {
    const sig = request.headers['stripe-signature'];

    let data;
    let eventType;

    try {
        const event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
        console.log('Webhook verified.');
        data = event.data.object;
        eventType = event.type;
    } catch (err) {
        console.log(`Webhook Error: ${err.message}`);
        response.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    if (eventType === 'checkout.session.completed') {
        stripe.customers.retrieve(data.customer)
            .then((customer) => {
                let cart = customer.metadata.cart;
                console.log(cart);

                if (typeof cart === 'string') {
                    try {
                        cart = JSON.parse(cart);
                    } catch (error) {
                        console.error('Error parsing cart:', error);
                    }
                }

                // Check if cart is now an array
                if (Array.isArray(cart)) {
                    Promise.all(cart.map((cartId) => db.checkout(cartId)))
                        .then(results => {
                            console.log('All checkouts completed successfully:', results);
                            response.status(200).send('All checkouts completed successfully');
                        })
                        .catch(err => {
                            console.error('Error in one of the checkouts:', err);
                            response.status(500).send('Error in one of the checkouts');
                        });
                } else {
                    console.error('customer.metadata.cart is not an array after parsing');
                    response.status(400).send('customer.metadata.cart is not an array after parsing');
                }
            })
            .catch(err => {
                console.log(err.message);
                response.status(500).send(err.message);
            });
    } else {
        response.status(400).send('Event type not handled');
    }
});


  
  module.exports = router