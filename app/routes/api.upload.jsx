import { json } from '@remix-run/node';
import imagekit from '../imagekit';
import { tursoDb } from './turso.server';
import { Buffer } from 'buffer'; 

export let action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        console.log(file, 'ffggggg');

        if (!file) {
            return json({ error: 'No file provided' });
        }

        const arrayBuffer = await file.arrayBuffer();

        const buffer = Buffer.from(arrayBuffer);

        const result = await imagekit.upload({
            file: buffer,        
            fileNameclear: file.name, 
        });

        return json({ url: result.url });
    } catch (error) {
        console.error(error);
        return json({ error: error.message });
    }
};
