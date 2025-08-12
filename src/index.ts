import { Hono } from 'hono'

type Bindings = {
  ACCEPTED_ORIGIN: string,
  BUCKET: R2Bucket
  IMAGES: ImagesBinding
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/preview/:key', async (c) => {
  // check whether the request origin is the same as this
  const referer = c.req.header('Referer')
  const url = new URL(referer || '')
  if (url.origin !== c.env.ACCEPTED_ORIGIN) {
    console.log(`Forbidden request from ${url.origin}, origin: ${c.env.ACCEPTED_ORIGIN}`)
    c.status(403)
    return c.text('Forbidden')
  }

  // validate key
  const key = c.req.param('key')
  if (!key) {
    console.log(`Bad request: missing key`)
    c.status(400)
    return c.text('Bad Request')
  }

  let image: ReadableStream | undefined = undefined

  try {
    // get image stream from r2
    image = (await c.env.BUCKET.get(key))?.body
    if (!image) {
      console.log(`Not Found: ${key}`)
      c.status(404)
      return c.text('Not Found')
    }
  } catch {
    console.log(`R2 error`)
    c.status(500)
    return c.text('R2 error')
  }

  try {
    // check whether the stream is an image
    await c.env.IMAGES.info(image)
  } catch {
    console.log(`Stream is not an image`)
    c.status(500)
    return c.text('Stream is not an image')
  }

  try {
    // resize the image stream using cloudflare images transform
    const response = (
      await c.env.IMAGES.input(image)
        .output({ format: "image/webp" })
    ).response();

    return response
  } catch {
    console.log(`Image transform error`)
    c.status(500)
    return c.text('Image transform error')
  }
})

app.get('/full/:key', async (c) => {
  // check whether the request origin is the same as this
  const referer = c.req.header('Referer')
  const url = new URL(referer || '')
  if (url.origin !== c.env.ACCEPTED_ORIGIN) {
    console.log(`Forbidden request from ${url.origin}, origin: ${c.env.ACCEPTED_ORIGIN}`)
    c.status(403)
    return c.text('Forbidden')
  }

  // validate key
  const key = c.req.param('key')
  if (!key) {
    console.log(`Bad request: missing key`)
    c.status(400)
    return c.text('Bad Request')
  }

  try {
    // get image stream from r2
    const image = await c.env.BUCKET.get(key)
    if (!image) {
      console.log(`Not Found: ${key}`)
      c.status(404)
      return c.text('Not Found')
    }

    return new Response(image.body)
  } catch {
    console.log(`R2 error`)
    c.status(500)
    return c.text('R2 error')
  }
})

export default app
