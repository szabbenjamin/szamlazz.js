/* eslint-env mocha */
'use strict'

const fs = require('fs')
const path = require('path')
const xmljs = require('libxmljs2')
const sinon = require('sinon')
const mockery = require('mockery')
const expect = require('chai').expect

const setup = require('./resources/setup')
const Constants = require('../src/lib/Constants').setup()

let requestStub

let client
let tokenClient
let seller
let buyer
let soldItem1
let soldItem2
let invoice
let receipt
let soldReceiptItem1
let soldReceiptItem2

let Szamlazz

beforeEach(function (done) {
  mockery.enable({
    warnOnReplace: false,
    warnOnUnregistered: false,
    useCleanCache: true
  })

  requestStub = sinon.stub()
  mockery.registerMock('axios', { post: requestStub }) // Disable this line to start a real api call

  Szamlazz = require('..')
  client = setup.createClient(Szamlazz)
  tokenClient = setup.createTokenClient(Szamlazz)
  seller = setup.createSeller(Szamlazz)
  buyer = setup.createBuyer(Szamlazz)
  soldItem1 = setup.createSoldItemNet(Szamlazz)
  soldItem2 = setup.createSoldItemGross(Szamlazz)
  invoice = setup.createInvoice(Szamlazz, seller, buyer, [soldItem1, soldItem2])
  soldReceiptItem1 = setup.createSoldReceiptItemNet(Szamlazz)
  soldReceiptItem2 = setup.createSoldReceiptItemGross(Szamlazz)
  receipt = setup.createReceipt(Szamlazz, [soldReceiptItem1, soldReceiptItem2])

  done()
})

afterEach(function (done) {
  mockery.disable()
  done()
})

describe('Client', function () {
  describe('constructor', function () {
    it('should set _options property', function (done) {
      expect(client).to.have.property('_options').that.is.an('object')
      done()
    })

    it('should set user', function (done) {
      expect(client._options).to.have.property('user').that.is.a('string')
      done()
    })

    it('should set password', function (done) {
      expect(client._options).to.have.property('password').that.is.a('string')
      done()
    })
  })

  describe('_generateInvoiceXML', function () {
    it('should return valid invoice XML', function (done) {
      fs.readFile(path.join(__dirname, 'resources', 'xmlszamla.xsd'), function (err, data) {
        if (!err) {
          let xsd = xmljs.parseXmlString(data)
          let xml = xmljs.parseXmlString(client._generateInvoiceXML(invoice))
          expect(xml.validate(xsd)).to.be.true
          done()
        }
      })
    })
  })

  describe('_generateReceiptXML', function () {
    it('should return valid receipt XML', function (done) {
      fs.readFile(path.join(__dirname, 'resources', 'xmlnyugtacreate.xsd'), function (err, data) {
        if (!err) {
          let xsd = xmljs.parseXmlString(data)
          let xml = xmljs.parseXmlString(client._generateReceiptXML(receipt))
          expect(xml.validate(xsd)).to.be.true
          done()
        }
      })
    })
  })

  describe('issueInvoice', function () {
    describe('HTTP status', function () {
      it('should handle failed requests', function () {
        requestStub.resolves({
          status: 500,
          statusMessage: 'Internal Server Error'
        })

        return client.issueInvoice(invoice).catch((err) => {
          expect(err).to.be.a('error')
        })
      })
    })

    describe('In case Szamlazz.hu returns an error', function () {
      describe('The header contains the error codes', () => {
        beforeEach(function () {
          requestStub.resolves({
            status: 200,
            headers: {
              szlahu_error_code: '57',
              szlahu_error: 'Some error message from the remote service'
            }
          })
        })

        it('should have error parameter', function () {
          return client.issueInvoice(invoice).catch((err) => {
            expect(err).to.be.a('error')
          })
        })

        it('should have code property', function () {
          return client.issueInvoice(invoice).catch((err) => {
            expect(err).to.have.property('code', '57')
          })
        })

        it('should have message property', function () {
          return client.issueInvoice(invoice).catch((err) => {
            expect(err).to.have.property('message', 'Some error message from the remote service')
          })
        })

        it.skip('szlahu_down: true header', () => {})
      })

      describe('The XML contains the error codes', () => {
        const errorXml = fs.readFileSync(path.join(__dirname, 'resources', 'issue_invoice_error.xml')).toString()

        beforeEach(function () {
          requestStub.resolves({
            status: 200,
            headers: {},
            data: errorXml
          })
          client.setResponseVersion(Constants.ResponseVersion.Xml)
        })

        it('should have error parameter', function () {
          return client.issueInvoice(invoice).catch((err) => {
            expect(err).to.be.a('error')
          })
        })

        it('should have code property', function () {
          return client.issueInvoice(invoice).catch((err) => {
            expect(err).to.have.property('code', '7')
          })
        })

        it('should have message property', function () {
          return client.issueInvoice(invoice).catch((err) => {
            expect(err).to.have.property('message', 'Hiányzó adat: számla agent xml lekérés hiba (ismeretlen számlaszám).')
          })
        })
      })
    })

    describe('XML response', () => {
      const responseHeaders = {
        szlahu_bruttovegosszeg: '6605',
        szlahu_nettovegosszeg: '5201',
        szlahu_szamlaszam: '2020-139'
      }

      describe('successful invoice generation without PDF download request', function () {
        beforeEach(function (done) {
          fs.readFile(path.join(__dirname, 'resources', 'issue_invoice_success_without_pdf.xml'), function (e, data) {
            requestStub.resolves({
              status: 200,
              headers: responseHeaders,
              data
            })

            client.setResponseVersion(Constants.ResponseVersion.Xml)
            client.setRequestInvoiceDownload(false)
            done()
          })
        })

        it('should have result parameter', function () {
          // requestStub.resolves(data)
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.all.keys('invoiceId', 'netTotal', 'grossTotal', 'pdf', 'pdfBase64')
          })
        })

        it('should have `invoiceId` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.property('invoiceId', responseHeaders.szlahu_szamlaszam).that.is.a('string')
          })
        })

        it('should have `netTotal` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.property('netTotal', responseHeaders.szlahu_nettovegosszeg)
            expect(parseFloat(result.netTotal)).is.a('number')
          })
        })

        it('should have `grossTotal` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.property('grossTotal', responseHeaders.szlahu_bruttovegosszeg)
            expect(parseFloat(result.grossTotal)).is.a('number')
          })
        })
      })

      describe('successful invoice generation with PDF download request', function () {
        beforeEach(function (done) {
          fs.readFile(path.join(__dirname, 'resources', 'issue_invoice_success_with_pdf.xml'), function (e, data) {
            requestStub.resolves({
              status: 200,
              headers: responseHeaders,
              data
            })

            client.setResponseVersion(Constants.ResponseVersion.Xml)
            client.setRequestInvoiceDownload(true)
            done()
          })
        })

        it('should have result parameter', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.all.keys('invoiceId', 'netTotal', 'grossTotal', 'pdf', 'pdfBase64')
            expect(result.pdf).to.be.an.instanceof(Buffer)
            expect(result.pdfBase64).to.be.equal('AAAAZg==')
          })
        })
      })
    })

    describe('PLAIN TEXT response', () => {
      const responseHeaders = {
        szlahu_bruttovegosszeg: '6605',
        szlahu_nettovegosszeg: '5201',
        szlahu_szamlaszam: '2020-139'
      }

      describe('successful invoice generation without PDF download request', function () {
        beforeEach(function () {
          requestStub.resolves({
            status: 200,
            headers: responseHeaders,
            data: 'xmlagentresponse=DONE;XY-2020-25\n'
          })

          client.setResponseVersion(Constants.ResponseVersion.PlainTextOrPdf)
          client.setRequestInvoiceDownload(false)
        })

        it('should have result parameter', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.all.keys('invoiceId', 'netTotal', 'grossTotal', 'pdf', 'pdfBase64')
            expect(result).to.have.property('pdf', undefined)
            expect(result).to.have.property('pdfBase64', undefined)
          })
        })

        it('should have `invoiceId` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.property('invoiceId', responseHeaders.szlahu_szamlaszam).that.is.a('string')
          })
        })

        it('should have `netTotal` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.property('netTotal', responseHeaders.szlahu_nettovegosszeg)
            expect(parseFloat(result.netTotal)).is.a('number')
          })
        })

        it('should have `grossTotal` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.property('grossTotal', responseHeaders.szlahu_bruttovegosszeg)
            expect(parseFloat(result.grossTotal)).is.a('number')
          })
        })
      })

      describe('successful invoice generation with PDF download request', function () {
        beforeEach(function (done) {
          fs.readFile(path.join(__dirname, 'resources', 'sample.pdf'), function (e, data) {
            requestStub.resolves({
              status: 200,
              headers: responseHeaders,
              data
            })

            client.setResponseVersion(Constants.ResponseVersion.PlainTextOrPdf)
            client.setRequestInvoiceDownload(true)
            done()
          })
        })

        it('should have result parameter', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result).to.have.all.keys('invoiceId', 'netTotal', 'grossTotal', 'pdf', 'pdfBase64')
          })
        })

        it('should have `pdf` property', function () {
          return client.issueInvoice(invoice).then((result) => {
            expect(result.pdf).to.be.an.instanceof(Buffer)
            expect(result.pdfBase64).not.to.be.empty
          })
        })
      })
    })
  })

  describe('Receipt', () => {
    describe('The XML contains the error codes', () => {
      const errorXml = fs.readFileSync(path.join(__dirname, 'resources', 'issue_receipt_error.xml')).toString()

      beforeEach(function () {
        requestStub.resolves({
          status: 200,
          headers: {},
          data: errorXml
        })
        client.setResponseVersion(Constants.ResponseVersion.Xml)
      })

      it('should have error parameter', function () {
        return client.issueReceipt(receipt).catch((err) => {
          expect(err).to.be.a('error')
          expect(err).to.have.property('code', '3')
          expect(err).to.have.property('message', 'Sikertelen bejelentkezés.')
        })
      })
    })

    describe('successful RECEIPT generation without PDF download request', function () {
      const xml = fs.readFileSync(path.join(__dirname, 'resources', 'issue_receipt_success_without_pdf.xml')).toString()

      beforeEach(function () {
        requestStub.resolves({
          status: 200,
          headers: {},
          data: xml
        })
        tokenClient.setRequestInvoiceDownload(false)
      })

      it('should have result parameter', function () {
        return tokenClient.issueReceipt(receipt).then((result) => {
          expect(result).to.have.all.keys('receiptId', 'netTotal', 'grossTotal', 'pdf', 'pdfBase64')
          expect(result).to.have.property('receiptId', 'NYGTA-2020-3')
          expect(result).to.have.property('netTotal', '5201')
          expect(result).to.have.property('grossTotal', '6605')
        })
      })
    })
    describe('successful RECEIPT generation with PDF download request', function () {
      const xml = fs.readFileSync(path.join(__dirname, 'resources', 'issue_receipt_success_with_pdf.xml')).toString()

      beforeEach(function () {
        requestStub.resolves({
          status: 200,
          headers: {},
          data: xml
        })
        tokenClient.setRequestInvoiceDownload(true)
      })

      it('should have result parameter', function () {
        return tokenClient.issueReceipt(receipt).then((result) => {
          expect(result).to.have.all.keys('receiptId', 'netTotal', 'grossTotal', 'pdf', 'pdfBase64')
          expect(result).to.have.property('receiptId', 'NYGTA-2020-3')
          expect(result).to.have.property('netTotal', '5201')
          expect(result).to.have.property('grossTotal', '6605')
          expect(result.pdf).to.be.an.instanceof(Buffer)
          expect(result.pdfBase64).to.be.equal('AAAAZg==')
        })
      })
    })
  })
})

describe('Client with auth token', function () {
  describe('constructor', function () {
    it('should set _options property', function () {
      expect(tokenClient).to.have.property('_options').that.is.an('object')
    })

    it('should set authToken', function () {
      expect(tokenClient._options).to.have.property('authToken').that.is.a('string')
    })

    it('should not set user', function () {
      expect(tokenClient._options).to.not.have.property('user')
    })
    it('should not set password', function () {
      expect(tokenClient._options).to.not.have.property('password')
    })
  })

  describe('_generateInvoiceXML', function () {
    it('should return valid XML', function () {
      fs.readFile(path.join(__dirname, 'resources', 'xmlszamla.xsd'), function (err, data) {
        if (!err) {
          let xsd = xmljs.parseXmlString(data)
          let xml = xmljs.parseXmlString(tokenClient._generateInvoiceXML(invoice))
          expect(xml.validate(xsd)).to.be.true
        }
      })
    })
  })
})
