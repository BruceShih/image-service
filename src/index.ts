import { Hono } from 'hono'

type Bindings = {
  ORIGIN: string,
  BUCKET: R2Bucket
  IMAGES: ImagesBinding
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/preview/:key', async (c) => {
  // check whether the request origin is the same as this
  if (c.req.header('Origin') !== c.env.ORIGIN) {
    return c.status(403)
  }

  // validate key
  const key = c.req.param('key')
  if (!key) {
    return c.status(400)
  }

  let image: ReadableStream | undefined = undefined

  try {
    // get image stream from r2
    image = (await c.env.BUCKET.get(key))?.body
    if (!image) { return c.status(404) }
  } catch {
    c.status(500)
    return c.text('r2 error')
  }

  try {
    // check whether the stream is an image
    await c.env.IMAGES.info(image)
  } catch {
    c.status(500)
    return c.text('stream is not a image')
  }

  try {
    // resize the image stream using cloudflare images transform
    const response = (
      await c.env.IMAGES.input(image)
        .output({ format: "image/webp" })
    ).response();

    return response
  } catch {
    c.status(500)
    return c.text('image transform error')
  }
})

app.get('/full/:key', async (c) => {
  // check whether the request origin is the same as this
  if (c.req.header('Origin') !== c.env.ORIGIN) {
    return c.status(403)
  }

  // validate key
  const key = c.req.param('key')
  if (!key) {
    return c.status(400)
  }

  try {
    // get image stream from r2
    const image = await c.env.BUCKET.get(key)
    if (!image) { return c.status(404) }

    return new Response(image.body)
  } catch {
    c.status(500)
    return c.text('r2 error')
  }
})

export default app
