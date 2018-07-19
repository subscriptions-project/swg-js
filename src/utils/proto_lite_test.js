import {
  ShowOffers,
  MessageEnvelope,
  deserializer,
  isEqual,
} from './proto_lite';
describe('proto_lite', () => {
  describe('test_showOffers', () => {
    it('should deserialize correctly', () => {
      const /** !ShowOffers */ showOffers = new ShowOffers([]);
      showOffers.setProductId('basic');
      showOffers.addSkus('sku1');
      showOffers.addSkus(['sku2', 'sku3']);
      const /** {?Object} */ showOffersDeserialized =
          deserializer(showOffers.toArray());
      expect(showOffersDeserialized != null).to.be.true;
      expect(isEqual(showOffers.toArray(),
          showOffersDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_message_envelope', () => {
    it('should deserialize correctly', () => {
      const /** !ShowOffers */ showOffers = new ShowOffers([]);
      showOffers.setProductId('basic');
      showOffers.addSkus('sku1');
      showOffers.addSkus(['sku2', 'sku3']);
      const /** !MessageEnvelope */ messageEnvelope = new MessageEnvelope([]);
      messageEnvelope.setPublicationId('pub1');
      messageEnvelope.setShowOffers(showOffers);
      const /** {?Object} */ deserializedMessageEnvelope =
          deserializer(messageEnvelope.toArray());
      expect(deserializedMessageEnvelope != null).to.be.true;
      expect(isEqual(messageEnvelope.toArray(),
          deserializedMessageEnvelope.toArray())).to.be.true;
    });
  });
  
});
