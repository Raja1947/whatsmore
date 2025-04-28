import { json } from '@remix-run/node';
import ImageKit from 'imagekit';

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});
//  const getAuthParams = () => {
//     return imagekit.getAuthenticationParameters();
//   };
const {token, expire, signature}= imagekit.getAuthenticationParameters()
console.log(token, expire, signature, 'simple')



export let action = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        console.log(file, 'ffggggg');

        if (!file) {
            return json({ error: 'No file provided' });
        }

        // const arrayBuffer = await file.arrayBuffer();

        // const buffer = Buffer.from(arrayBuffer);

        const result = await imagekit.upload({
            file: file,        
            fileName: file.name, 
            token:token,
            expire:expire,
            signature:signature
            
        });

        return json({ url: result.url });
    } catch (error) {
        console.error(error);
        return json({ error: error.message });
    }
};
