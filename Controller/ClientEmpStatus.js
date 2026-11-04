import { sql, pool, poolConnect } from '../DatabaseConfig/DB.js';

export const ClientEmpStatus = async (req, res) => {
    // Accept only POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { Clientemail } = req.body;

    if (!Clientemail) {
        return res.status(400).json({ message: 'Clientemail is required in the request body.' });
    }

    try {
        await poolConnect;
        const request = pool.request();
        request.input('Clientemail', sql.VarChar(255), Clientemail);

        const result = await request.query(
            "SELECT * FROM WorktrailclientData WHERE Clientemail = @Clientemail order by CreatedAT desc"
        );

        return res.status(200).json({ data: result.recordset });
    } catch (error) {
        console.error('Error fetching employee status:', error);
        return res.status(500).json({ message: 'Database query failed.' });
    }
}