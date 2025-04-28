import { useState } from 'react';

export default function ImageUpload() {
    const [image, setImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState(null);

    const handleImageChange = (e) => {
        setImage(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!image) return;

        setUploading(true);

        const formData = new FormData();
        formData.append('file', image);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        setUploading(false);

        if (data.url) {
            setImageUrl(data.url);
        } else {
            alert('Error uploading image');
        }
    };

    return (
        <div>
            <input type="file" onChange={handleImageChange} />
            <button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload Image'}
            </button>

            {imageUrl && <img src={imageUrl} alt="Uploaded Image" />}
        </div>
    );
}



