require('dotenv').config()

const Pool = require('pg').Pool;
const pool = new Pool({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT_POOL,
    ssl: {
        rejectUnauthorized: false
    }
})

const bcrypt = require('bcrypt');
if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
  }
  

const getAllProducts = (req, res) => {
    
    pool.query('SELECT * FROM prodotti', (err, result) => {
        if(err){
            throw err
        }
        res.status(200).send(result.rows)
    })
}


const getProductsDetailById = (req, res) => {
    const id = parseInt(req.params.id)

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }

    pool.query(`
        SELECT *
        FROM dettaglio
        INNER JOIN prodotti ON dettaglio.id = prodotti.dettaglio_id
        WHERE prodotti.id = $1;    
        `, [id], (err, result) => {
        if(err) {
            throw err
        }

        if(result.rows.length > 0){
            res.status(200).send(result.rows)
        }else{
            res.status(404).send(['Nessun elemento trovato'])
        }
    })
}


const createUser = (nome, cognome, email, hashedPassword) => {
    return new Promise((resolve, reject) => {
        pool.query(
            'INSERT INTO clienti (nome, cognome, email, password) VALUES ($1, $2, $3, $4) RETURNING *',
            [nome, cognome, email, hashedPassword],
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.rows[0]);
                }
            }
        );
    });
}

const getAllUsers = (req, res) => {
    pool.query('SELECT * FROM clienti', (err, result) => {
        if(err){
            throw err
        }
        if(result.rows.length > 0){
            res.status(200).send(result.rows)
        }else{
            res.status(404).send(['Nessun elemento trovato'])
        }
    })
}

const getUsersByID = (req, res) => {
    const id = parseInt(req.params.id);

    pool.query(`
    SELECT nome, cognome, email
    FROM clienti
    WHERE id = $1
    `, [id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (result.rows.length > 0) {
            res.status(200).send(result.rows);
        } else {
            res.status(404).send(['Nessun elemento trovato']);
        }
    });
};


const getUsers = (req, res) => {
    if (!req.user || !req.user.email) {
        return res.status(401).json({ error: 'Utente non autenticato o email non trovata' });
    }

    const { email } = req.user;

    pool.query(`
    SELECT nome, cognome, email
    FROM clienti
    WHERE email = $1
    `, [email], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }

        if (result.rows.length > 0) {
            res.status(200).send(result.rows);
        } else {
            res.status(404).send(['Nessun elemento trovato']);
        }
    });
};



const updateUser = async(req, res) => {
    const { nome, cognome, password } = req.body;
    const { email } = req.user
    if (!email) {
        res.status(401).json('/login');
        return;
    }

    let hashedPassword;
    if(password){
        hashedPassword = await bcrypt.hash(password, 10);
    }

    let setClause = '';
    if (nome) setClause += `nome = '${nome}', `;
    if (cognome) setClause += `cognome = '${cognome}', `;
    if (password) setClause += `password = '${hashedPassword}', `;

    setClause = setClause.slice(0, -2);

    const query = `UPDATE clienti SET ${setClause} WHERE email = $1`;

    pool.query(query, [email], (error, result) => {
        if (error) {
            throw error;
        }
        res.status(200).send(`Utente modificato con l'email: ${email}`);
    });
};

const deleteUser = (req, res) => {
    const { email } = req.user
    
    pool.query('DELETE FROM clienti WHERE email = $1', [email], (err, result) => {
        if(err) {
            throw err
        }
        res.status(200).send(`Account eliminato con l'email: ${email}`)
    })
}



const getOrdersById = (req, res) => {
    const id = parseInt(req.params.id);
    const { email } = req.user

    if(!email) {
        res.status(400).json('/login' );
        return;
    }

    pool.query(`
    SELECT *
    FROM ordini
    INNER JOIN carrello 
    ON ordini.carrello_id = carrello.id
    WHERE ordini.carrello_id = $1 AND cliente_email = $2`, 
    [id, email], (err, result) => {
        if(err) {
            throw err
        }

        if(result.rows.length > 0){
            res.status(200).send(result.rows)
        }else{
            res.status(404).send(['Nessun elemento trovato'])
        }
    })
}

const updateOrdersById = (req, res) => {
    const id = parseInt(req.params.id);
    const { stato } = req.body;
    const { email } = req.user;

    pool.query(
        `UPDATE ordini 
        SET stato = $1 
        WHERE id IN (
            SELECT ordini.id
            FROM ordini
            INNER JOIN carrello ON ordini.carrello_id = carrello.id
            WHERE ordini.carrello_id = $2 AND cliente_email = $3
        )`, 
        [stato, id, email],  
        (err, result) => {
            if (err) {
                throw err;
            }
            res.status(200).send(`Ordine modificato con l'ID: ${id}`);
        }
    );
};



const deleteOrder = (req, res) => {
    const id = req.params.id
    const { email } = req.user;

    pool.query(
        'DELETE FROM ordini WHERE id IN (SELECT ordini.id FROM ordini INNER JOIN carrello ON ordini.carrello_id = carrello.id WHERE ordini.carrello_id = $1 AND cliente_email = $2)', 
        [id, email], (err, result) => {
            if(err){
                throw err
            }
            res.status(200).send(`Ordine eliminato con l'ID: ${id}`)
        }
    )
}


const cardValidator = require('card-validator');
const checkout = (req, res) => {
    const cartId = req.params.cartId; //cambio in email per prendere tutti quelli attivi sull'email
    const { paymentDetails } = req.body;

    if(paymentDetails.cardNumber.length === 0 || paymentDetails.expiryDate.length === 0 || paymentDetails.cvv.length === 0 ||  paymentDetails.billingAddress.length === 0){
        res.status(500).send('Dati carta non inseriti');
        return;
    }


    if (!cardValidator.number(paymentDetails.cardNumber).isValid) {
        res.status(500).send('Errore durante la verifica della carta');
        return;
    }

    pool.query('SELECT * FROM ordini WHERE carrello_id = $1', [cartId], (err, result) => {
        if (err) {
            console.error('Errore durante la verifica dell\'esistenza dell\'ordine:', err);
            res.status(500).send('Errore durante la verifica dell\'esistenza dell\'ordine');
            return;
        }

        if (result.rows.length > 0) {
            res.status(400).send('Il carrello ha già un ordine associato');
            return;
        }

        const orderDate = new Date();
        const orderStatus = 'In attesa';

        
        pool.query('UPDATE carrello SET attivo = FALSE WHERE id = $1', [cartId], (err, result) => {
            if(err) {
                throw err
            }

            
        pool.query(
            'INSERT INTO ordini (data_ordine, stato, carrello_id) VALUES ($1, $2, $3) RETURNING *',
            [orderDate, orderStatus, cartId],
            (err, result) => {
                if (err) {
                    console.error('Errore durante la creazione dell\'ordine:', err);
                    res.status(500).send('Errore durante la creazione dell\'ordine');
                    return;
                }

                if (result.rows.length === 0) {
                    res.status(404).send('Nessun ordine creato');
                    return;
                }

                const order = result.rows[0];
                res.status(200).json({
                    message: 'Ordine creato con successo',
                    order: order,
                    paymentDetails: paymentDetails
                });
            });
        })
    });
};


const getCategory = (req, res) => {
    
    const queryCategory = req.query.category
    if (!queryCategory) {
        res.status(400).send({ error: 'Il parametro di categoria è richiesto' });
        return;
    }

    pool.query(`SELECT * FROM prodotti WHERE categoria = $1`, [queryCategory], (err, result) => {
    
        if(result.rows.length === 0){
            res.status(404).send({ message: 'Nessun prodotto trovato per questa categoria' });
            return;
        }
        else if(err){
            throw err
        }

        res.status(200).send(result.rows)
    })
}


const createProduct = (req, res) => {

    const { email } = req.user
    if(email !== process.env.ADMIN_EMAIL){
        res.status(403).send('Non puoi aggiungere prodotti perché non sei autorizzato')
        return;
    }

    const { categoria, nome, prezzo } = req.body
    const { taglie, materiali, descrizione } = req.body

    pool.query('INSERT INTO dettaglio (taglie, materiali, descrizione) VALUES ($1, $2, $3) RETURNING id', [taglie, materiali, descrizione], (err, result) => {
        if(err){
            throw err
        } else if(result.rows.length === 0) {
            res.status(404).send('Nessun dettaglio creato')
        }

        const dettaglio_id = result.rows[0].id

        pool.query('INSERT INTO prodotti (categoria, nome, prezzo, dettaglio_id) VALUES ($1, $2, $3, $4) RETURNING *', [categoria, nome, prezzo, dettaglio_id], (err, result) => {
            if(err){
                throw err
            } else if(result.rows.length === 0) {
                res.status(404).send('Nessun prodotto creato')
            }

            res.status(201).send(result.rows[0])
        })
    })
}


const deleteProducts = (req, res) => {
    const id = req.params.id

    pool.query('DELETE FROM prodotti WHERE dettaglio_id = $1 RETURNING *', [id], (err, result) => {
        if(err){
            throw err
        } else if(result.rows.length === 0){
            res.status(404).send('Nessun prodotto trovato')
        }

        pool.query ('DELETE FROM dettaglio WHERE id = $1 RETURNING *', [id], (err, result) => {
            if(err){
                throw err
            } else if(result.rows.length === 0){
                res.status(404).send('Nessun dettaglio trovato')
            }   
            res.status(200).send(`Eliminato prodotto: ` + result.rows[0].id)

        })
    })
}


const updateProduct = (req, res) => {
    const { categoria, nome, prezzo } = req.body;
    const id = req.params.id

    pool.query(
        'UPDATE prodotti SET categoria = $1, nome = $2, prezzo = $3 WHERE id = $4 RETURNING *',
        [categoria, nome, prezzo, id],
        (err, result) => {
            if (err) {
                console.error('Errore durante l\'aggiornamento del prodotto:', err);
                res.status(500).send('Errore durante l\'aggiornamento del prodotto');
                return;
            }

            else if (result.rows.length === 0) {
                res.status(404).send('Nessun prodotto modificato');
                return;
            }

            res.status(200).send('Prodotto modificato');
        }
    );
};


const updateDetail = (req, res) => {
    const { taglie, materiali, descrizione } = req.body;
    const id = req.params.id

    pool.query('UPDATE dettaglio SET taglie = $1, materiali = $2, descrizione = $3 WHERE id = $4 RETURNING *',
    [taglie, materiali, descrizione, id], (err, result) => {
        if (err) {
            console.error('Errore durante l\'aggiornamento del dettaglio:', err);
            res.status(500).send('Errore durante l\'aggiornamento del dettaglio');
            return;
        }

        else if (result.rows.length === 0) {
            res.status(404).send('Nessun dettaglio è stato modificato');
            return;
        }

        res.status(200).send('Dettaglio modificato');
    })
}




const getOrdersProdottiById = (req, res) => {
    const id = req.params.id;
    const { email } = req.user

        if (!email) {
        res.status(400).json('/login' );
        return;
    }

    const query = `
        SELECT 
            ordini.id AS id_ordine,
            ordini.data_ordine,
            ordini.stato,
            carrello.quantita,
            carrello.cliente_email,
            prodotti.nome AS nome_prodotto,
            prodotti.prezzo AS prezzo_prodotto,
            dettaglio.taglie,
            dettaglio.materiali,
            dettaglio.descrizione AS descrizione_prodotto,
            clienti.nome AS nome_cliente,
            clienti.cognome AS cognome_cliente,
            clienti.email AS email_cliente
        FROM 
            ordini
        JOIN 
            carrello ON ordini.carrello_id = carrello.id
        JOIN 
            prodotti ON carrello.prodotto_id = prodotti.id
        JOIN 
            dettaglio ON prodotti.dettaglio_id = dettaglio.id
        JOIN 
            clienti ON carrello.cliente_email = clienti.email
        WHERE 
            ordini.carrello_id = $1 AND cliente_email = $2;
    `;
    pool.query(query, [id, email], (err, result) => {
        if (err) {
            console.error('Errore durante il recupero dell\'ordine del prodotto:', err);
            res.status(500).json({ error: 'Errore durante il recupero dell\'ordine del prodotto' });
            return;
        }
        if (result.rows.length > 0) {
            res.status(200).json(result.rows[0]);
        } else {
            res.status(404).json({ message: 'Nessun elemento trovato' });
        }
    });
};



const getCartUser = (req, res) => {

    const { email } = req.user
    if (!email) {
        res.status(400).json('/login' );
        return;
    }
 
    pool.query('SELECT * FROM carrello WHERE cliente_email = $1', [email], (err, result) => {

        if(result.rows.length === 0){
            res.status(404).send({ message: 'Nessuna email trovata' });
            return;
        }
        else if(err){
            throw err
        }

        res.status(200).send(result.rows)
    })
}
    


const updateCart = (req, res) => {
    const id = req.params.id;
    const { prodotto_id, quantita } = req.body;
    const { email } = req.user

    pool.query('UPDATE carrello SET prodotto_id = $1, quantita = $2, cliente_email = $3 WHERE id = $4 AND cliente_email = $5', [ prodotto_id, quantita, email, id, email], (err, result) => {
        if (err) {
            console.error('Errore durante l\'aggiornamento del carrello:', err);
            res.status(500).json({ error: 'Errore durante l\'aggiornamento del carrello' });
            return;
        }
        if (result.rowCount === 0) {
            res.status(404).json({ message: `Nessun carrello trovato con l'ID: ${id}` });
            return;
        }
        res.status(200).send(`Prodotto modificato con l'ID: ${id}`);
    });
};


const createCart = (req, res) => {
    const { id, sizeSelected } = req.body;
    const { email } = req.user;
    
    if (!email || !req.user) {
      res.status(401).json({ message: 'Unauthorized. Please log in.' });
      return;
    }
  
    pool.query(
      'INSERT INTO carrello (prodotto_id, quantita, cliente_email, taglia_selezionata) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, 1, email, sizeSelected],
      (err, result) => {
        if (err) {
          console.error('Error adding to cart:', err);
          res.status(500).json({ error: 'Error adding to cart' });
          return;
        }
        if (result.rowCount === 0) {
          res.status(404).json({ message: `No product found with ID: ${id}` });
          return;
        }
        res.status(200).json({ message: `Product added with ID: ${result.rows[0].id}` });
      }
    );
  };
  



const addCart = (req, res) => {
    const { id } = req.params.id;
    const { quantita } = req.body;
    const { email } = req.user;
    
    if (!email || !req.user) {
      res.status(401).json({ message: 'Unauthorized. Please log in.' });
      return;
    }
  
    pool.query(
      'UPDATE carrello SET quantita = $1 WHERE id = $2 RETURNING *',
      [quantita, id],
      (err, result) => {
        if (err) {
          console.error('Error adding to cart:', err);
          res.status(500).json({ error: 'Error adding to cart' });
          return;
        }
        if (result.rowCount === 0) {
          res.status(404).json({ message: `No cart found with ID: ${id}` });
          return;
        }
        res.status(200).json({ message: `Cart added with ID: ${result.rows[0].id}` });
      }
    );
}




const deleteCart = (req, res) => {
    const id = req.params.id;
    const { email } = req.user;
  
    if (!email || !req.user) {
      return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }
  
    pool.query('DELETE FROM carrello WHERE id = $1 AND cliente_email = $2', [id, email], (err) => {
      if (err) {
        console.error('Error deleting product from cart:', err);
        return res.status(500).json({ error: 'Error deleting product from cart' });
      }
  
      res.status(200).send(`Prodotto eliminato con l'ID: ${id}`);
    });
  };


  
const findByEmail = (email, callback) => {
    pool.query('SELECT * FROM clienti WHERE email = $1', [email], (err, result) => {
        if (err) {
            return callback(err, null);
        }
        if (result.rows.length === 0) {
            return callback(null, null); 
        }
        return callback(null, result.rows[0]);
    });
};

const findById = (id, callback) => {
    pool.query('SELECT * FROM clienti WHERE id = $1', [id], (err, result) => {
        if (err) {
            return callback(err, null);
        }
        if (result.rows.length === 0) {
            return callback(null, null); 
        }
        return callback(null, result.rows[0]);
    });
}


const dashboard = (req, res) => {
    
    if (!req.user || !req.user.email) {
        return res.status(401).json({ error: 'User not authenticated or email not found' });
    }

    const { email } = req.user
    if(!email) {
        res.status(400).json({ message: 'You are not logged in' })
    }
        res.status(200).send(req.user);
  };
  

const login = (req, res) => {
    
    if (req.user) {
        return res.status(200).json('Loggato');
    } else {
        return res.status(204).json('Sign-in');
    }
}

const cartActive = (req, res) => {
    const { email } = req.user;
    if (!email || !req.user) {
      res.status(401).json('/login');
      return;
    }
  
    const query = `
        SELECT 
        c.id AS carrello_id, 
        *, 
        (SELECT COUNT(*) 
        FROM carrello 
        WHERE cliente_email = $1 AND attivo = TRUE) AS total_elements
        FROM carrello c
        INNER JOIN prodotti p ON c.prodotto_id = p.id
        INNER JOIN dettaglio d ON p.dettaglio_id = d.id
        WHERE c.cliente_email = $1 AND c.attivo = TRUE
        ORDER BY c.id DESC
    `;
  
    pool.query(query, [email], (err, result) => {
      if (err) {
        console.error('Errore nella query:', err);
        res.status(500).send({ message: 'Errore interno del server' });
        return;
      }
  
      if (result.rows.length === 0) {
        res.status(200).json([{total_elements: 0}]);
        return;
      }
  
      res.status(200).send(result.rows);
    });
  };



  const cartInactive = (req, res) => {
    const { email } = req.user;
    if (!email) {
        res.status(401).json('/login');
        return;
    }
  
    const query = `
      SELECT *
      FROM carrello
      LEFT JOIN ordini ON ordini.carrello_id = carrello.id
      INNER JOIN prodotti ON carrello.prodotto_id = prodotti.id
      INNER JOIN dettaglio ON prodotti.dettaglio_id = dettaglio.id
      WHERE carrello.cliente_email = $1 AND carrello.attivo = FALSE
      ORDER BY ordini.data_ordine DESC;
    `;
  
    pool.query(query, [email], (err, result) => {
      if (err) {
        console.error('Errore nella query:', err);
        res.status(500).send({ message: 'Errore interno del server' });
        return;
      }
  
      else if (result.rows.length === 0 || result.rows === undefined) {
        res.status(404).send({ message: "Looks like you don't have any orders yet"});
        return;
      }
  
      res.status(200).send(result.rows);
    });
  };


  
  const getShipments = (req, res) => {
    const { email } = req.user;
    if (!email) {
        res.status(401).json('/login');
        return;
    }

    pool.query(`
        SELECT ordini.id, ordini.data_ordine, ordini.stato, ordini.carrello_id, prodotti.categoria, prodotti.prezzo, prodotti.image_urls, carrello.quantita, prodotti.nome
        FROM ordini
        INNER JOIN carrello ON ordini.carrello_id = carrello.id
        INNER JOIN prodotti ON carrello.prodotto_id = prodotti.id
        WHERE carrello.cliente_email = $1
        ORDER BY ordini.data_ordine DESC;
    `, [email], (err, result) => {

        if (err) {
            console.error('Error fetching orders:', err);
            res.status(500).json({ message: 'Internal server error' });
            return;
        }

        else if (result.rows.length === 0 || result.rows === undefined) {
            res.status(404).json({ message: "Looks like you don't have any shipments yet" });
            return;
        }

        res.status(200).json(result.rows);
    });
}
  

module.exports = {
    getProductsDetailById,
    createUser,
    getAllUsers,
    getUsersByID,
    getUsers,
    updateUser,
    deleteUser,
    getOrdersById,
    updateOrdersById,
    deleteOrder,
    getAllProducts,
    getOrdersProdottiById,
    updateCart,
    createCart,
    addCart,
    deleteCart,
    findByEmail,
    findById,
    dashboard,
    login,
    getCategory,
    createProduct,
    deleteProducts,
    updateProduct,
    updateDetail,
    getCartUser,
    checkout,
    cartActive,
    cartInactive,
    getShipments
}