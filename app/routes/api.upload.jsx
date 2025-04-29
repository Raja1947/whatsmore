import ImageKit from 'imagekit'
export async function loader() {
	if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY) {
    return new Response(null, { status: 500 })
  }
  
  return new Response(JSON.stringify(imagekit.getAuthenticationParameters()), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}