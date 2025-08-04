import axios from "axios";

interface SignedUrlResponse {
  signedUrl: string;
  fileUrl: string;
}

export const uploadFileToS3 = async (file: File): Promise<string> => {
  try {
    // Get signed URL from backend
    const response = await axios.get<SignedUrlResponse>(
      "https://chatdist.vercel.app/api/upload/signed-url",
      {
        params: {
          fileName: file.name,
          fileType: file.type,
        },
      }
    );

    const { signedUrl, fileUrl } = response.data;

    // Upload file to S3
    await axios.put(signedUrl, file, {
      headers: {
        "Content-Type": file.type,
      },
    });

    return fileUrl;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("File upload failed");
  }
};
