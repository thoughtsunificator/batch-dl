#!/usr/bin/env node

const logger = require("tracer").dailyfile({
		root: "./logs",
		maxLogFiles: 10,
		allLogsFileName: "batch-download"
})
const fs = require("fs")
const https = require('https');
const http = require('http');
const path = require("path")

const PATH_DOWNLOAD_DIRECTORY = "./downloads/"

if (!fs.existsSync("./logs")) {
	fs.mkdirSync("./logs");
}

if (!fs.existsSync(PATH_DOWNLOAD_DIRECTORY)) {
	fs.mkdirSync(PATH_DOWNLOAD_DIRECTORY);
}

if(process.argv.length >= 3) {
	const input = process.argv[2]
	if(fs.existsSync(input)) {
		fs.readFile(input, "UTF-8", function(error, data) {
			if(error !== null) {
					throw error
			}
			const urls = data.split(/\r?\n/).filter(Boolean)
			recursive(urls, 0, downloadFileFromURL)
		})
	} else {
		console.log("Error: The input file could not be found.")
	}
} else {
	console.log("Error: Please provide an input file.")
}

function recursive(array, index, method) {
	if(typeof array[index] === "undefined") {
		return
	}
	if(typeof array[index + 1] !== "undefined") {
		method(array[index], recursive.bind(null, array, index + 1, method))
	} else {
		method(array[index])
	}
}

function getRealFileName(url, serverResponse) {
	let fileName
	if(typeof serverResponse.headers["content-disposition"] === "string"
		&& serverResponse.headers["content-disposition"].includes("filename=") === true) {
			fileName = serverResponse.headers["content-disposition"].split("filename=")[1]
	} else {
		let fileNamePath = path.parse(url)
		if(fileNamePath.ext !== "") {
			fileName = fileNamePath.name + fileNamePath.ext
		} else {
			fileName = fileNamePath.name
		}
	}
	return fileName
}

function downloadFileFromURL(url, callback) {
	logger.log("Attempting download on "+url)
	let client
	if(url.startsWith("https")) {
		client = https
	} else {
		client = http
	}
	const clientRequest = client.request(url, function(response) {
			let chunks = []
			logger.log(response.statusCode)
			logger.log(JSON.stringify(response.headers))
			response.on("data", function(chunk) {
				logger.log("data...")
				chunks.push(chunk)
				logger.log(chunk)
			})
			response.on("end", function() {
				logger.log("No more data in response.")
				let fileName = getRealFileName(url, response)
				fs.writeFile(PATH_DOWNLOAD_DIRECTORY + fileName, Buffer.concat(chunks), function(error) {
					if(error !== null) {
							throw error
					}
					logger.log(fileName +" has been saved.")
					if(typeof callback !== "undefined") {
						setTimeout(callback, 500)
					}
				})
			})
	})
	clientRequest.on("connection", function(e) {
	 logger.log("Connected to "+url+".")
	})
	clientRequest.on("error", function(e) {
		logger.error(e.message)
	})
	clientRequest.end()
}

