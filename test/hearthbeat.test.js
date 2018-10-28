const expect = require('expect');
process.env['HEARTH_BEAT_FREQUENCY'] = 1;
const hearthbeat = require('../ring/hearthbeat');


describe('Hearth beat', () => {
    
    it('Should send an hearth beat with correct frequency', (done) => {
        let ds = [];
        let count = 0;
        let client = {
            write : (msg) => {
                count++;
            },
            writable : true
        }
        hearthbeat(client,'asdl');
        setTimeout(()=> {
            expect(count >= 10).toBeTruthy();
            done();
        },20)
    });

    it('Shoulddo an hearth check with correct frequency', (done) => {
        let ds = [];
        let count = 0;
        let client = {
            write : (msg) => {
                count++;
            },
            writable : false
        }
        hearthbeat(client,'asdl');
        setTimeout(()=> {
            expect(count).toBe(0);
            done();
        },20)
    });

});
