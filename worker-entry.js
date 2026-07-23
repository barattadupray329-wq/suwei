import openNextWorker, {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js"

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache }

const worker = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (url.hostname === "tuzhuzu.cn") {
      url.hostname = "www.tuzhuzu.cn"
      return Response.redirect(url.toString(), 301)
    }

    return openNextWorker.fetch(request, env, ctx)
  },
}

export default worker
