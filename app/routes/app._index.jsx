import { Form, json, useActionData, useNavigate } from "@remix-run/react";
import { Button, DropZone, LegacyStack, Thumbnail, Text, Link } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Buffer } from "buffer";
import prisma from "../db.server";
import ImageKit from "imagekit";

export async function action({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    
    if (!file || typeof file === "string") {
      throw new Error("No valid file uploaded");
    }

    // File validation
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File size exceeds maximum allowed size (100MB)");
    }

    const ALLOWED_TYPES = [
      'video/mp4', 
      'video/quicktime', 
      'video/x-msvideo', 
      'video/webm',
      'video/mpeg'
    ];
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type. Only video files are allowed. Received: ${file.type}`);
    }

    const imagekit = new ImageKit({
      publicKey: "public_OxbyDHLl7mAo10apOvR70oHiGsU=",
      privateKey: "private_u+N6B/ftta2yH17yHzryN2/qfDQ=",
      urlEndpoint: "https://ik.imagekit.io/2d17j7ktvr",
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await imagekit.upload({
      file: buffer,
      fileName: file.name,
    });

    const newVideo = await prisma.uploadedFile.create({
      data: {
        url: result.url,
        duration: result.duration || 0,
      },
    });

    return json({ 
      success: true,
      newVideo,
      message: "Video uploaded successfully!" 
    });
  } catch (err) {
    console.error("Upload error:", err);
    return json({ 
      error: true,
      message: err.message || "Failed to upload video" 
    }, { status: 500 });
  }
}

export default function UploadPage() {
  const actionData = useActionData();
  const navigate=useNavigate();
  const app = useAppBridge();
  const [files, setFiles] = useState([]);
  const [rejectedFiles, setRejectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (actionData?.success) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setFiles([]);
        setRejectedFiles([]);
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [actionData]);

  const handleDrop = useCallback((_droppedFiles, acceptedFiles, rejectedFiles) => {
    setFiles(acceptedFiles);
    setRejectedFiles(rejectedFiles);
    
    // Update the hidden file input
    if (acceptedFiles.length > 0 && fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(acceptedFiles[0]);
      fileInputRef.current.files = dataTransfer.files;
    }
  }, []);

  const handleRemove = useCallback(() => {
    setFiles([]);
    setRejectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const fileUpload = !files.length && <DropZone.FileUpload />;
  const uploadedFiles = files.length > 0 && (
    <div style={{ padding: "0" }}>
      <LegacyStack vertical>
        {files.map((file, index) => (
          <LegacyStack alignment="center" key={index}>
            <Thumbnail
              size="small"
              alt={file.name}
              source={window.URL.createObjectURL(file)}
            />
            <div>
              <Text variant="bodyMd" fontWeight="medium" as="p">
                {file.name}
              </Text>
              <Text variant="bodySm" as="p">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </Text>
              <Text variant="bodySm" as="p">
                {file.type}
              </Text>
            </div>
            <Button onClick={handleRemove}>Remove</Button>
          </LegacyStack>
        ))}
      </LegacyStack>
    </div>
  );

  return (
    <div style={{ padding: "1rem", margin: "0 auto", maxWidth: "1000px" }}>

      <div style={{ marginBottom: "1.5rem", paddingBottom: "1.5rem",  borderBottom: "1px solid #e2e8f0", display:"flex", justifyContent:'space-between', alignItems:'center' }}>
        <h1 style={{ fontSize: "20px", fontWeight: "600", color: "#1e293b", margin: 0 }}>
          Upload New Video
        </h1>
        <div>
          <Button  onClick={()=>navigate("/app/additional")}>All Uploaded Videos</Button>
        </div>
      </div>

      {/* Success Message - Now controlled by showSuccess state */}
      {showSuccess && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            color: "#166534",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            border: "1px solid #bbf7d0",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#166534">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          {actionData?.message || "Video uploaded successfully!"}
        </div>
      )}

      {/* Error Message - Remains manually dismissible */}
      {actionData?.error && !showSuccess && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            border: "1px solid #fecaca",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b91c1c">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {actionData.message}
        </div>
      )}

      {/* Upload Section */}
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid lightgrey",
          padding: "2.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <Form
          method="post"
          encType="multipart/form-data"
          style={{ maxWidth: "1000px", margin: "0 auto" }}
          onSubmit={() => setIsUploading(true)}
        >
          <DropZone
            accept="video/*"
            type="file"
            onDrop={handleDrop}
            allowMultiple={false}
          >
            {uploadedFiles}
            {fileUpload}
          </DropZone>

          {/* Hidden file input */}
          <input
            type="file"
            name="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setFiles([e.target.files[0]]);
              }
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <Button 
              submit 
              primary 
              loading={isUploading} 
              disabled={files.length === 0}
            >
              Upload Video
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}