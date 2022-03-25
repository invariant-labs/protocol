module.exports = (req, res) => {
  console.log(req.query)
  const {
    query: { name }
  } = req

  res.send(`Hello ${name}!`)
}
