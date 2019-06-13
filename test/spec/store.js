import * as store from '../../src/store';

fdescribe('store:', () => {
  describe('get & set methods -', () => {
    describe('for primitive properties', () => {
      let Model;
      beforeEach(() => {
        Model = {
          firstName: String,
          lastName: String,
          fullName: ({ firstName, lastName }) => `${firstName} ${lastName}`,
        };
      });

      it('throws when assign new value to property', () => {
        store.set(Model, { firstName: 'John', lastName: 'Smith' });
        const model = store.get(Model);

        expect(() => { model.firstName = 'Arnold'; }).toThrow();
        expect(model.firstName).toBe('John');
      });

      it('throws when property is null', () => {
        const BrokenModel = { property: null };
        expect(() => store.set(BrokenModel, {})).toThrow();
      });

      it('throws when property is not an object or a function', () => {
        const BrokenModel = { property: '' };
        expect(() => store.set(BrokenModel, {})).toThrow();
      });

      it('throws when the first argument is not an object', () => {
        expect(() => store.get('')).toThrow();
        expect(() => store.set('')).toThrow();
      });

      it('throws when second argument is not an object', () => {
        expect(() => store.set({}, '')).toThrow();
      });

      it('adds "undefined" model', () => {
        store.set(Model, { firstName: 'John', lastName: 'Smith' });
        expect(store.get(Model)).toEqual({ firstName: 'John', lastName: 'Smith' });
        expect(store.get(Model).id).toBe(undefined);
      });

      it('transform default values', () => {
        store.set(Model, { });
        expect(store.get(Model)).toEqual({ firstName: '', lastName: '' });
      });

      it('omits not defined properties', () => {
        store.set(Model, { test: 'test' });
        expect(store.get(Model)).toEqual({ firstName: '', lastName: '' });
      });


      it('adds models with different id types to the same string ids', () => {
        store.set(Model, { id: '1', firstName: 'A', lastName: 'B' });
        store.set(Model, { id: 2, firstName: 'C', lastName: 'D' });
        const userOne = store.get(Model, '1');
        const userTwo = store.get(Model, 2);

        expect(userOne).toEqual({ firstName: 'A', lastName: 'B' });
        expect(userTwo).toEqual({ firstName: 'C', lastName: 'D' });

        expect(userOne).toBe(store.get(Model, 1));
        expect(userTwo).toBe(store.get(Model, '2'));
      });

      it('updates model by instance', () => {
        store.set(Model, { id: '1', firstName: 'John', lastName: 'Smith' });
        const userBefore = store.get(Model, '1');

        store.set(userBefore, { firstName: 'Arnold' });
        const userAfter = store.get(Model, '1');

        expect(userAfter).not.toBe(userBefore);
        expect(userAfter).toEqual({ firstName: 'Arnold', lastName: 'Smith' });
      });

      it('updates model by values with id property', () => {
        store.set(Model, { id: '1', firstName: 'John', lastName: 'Smith' });
        store.set(Model, { id: '1', firstName: 'Arnold' });

        expect(store.get(Model, '1')).toEqual({ firstName: 'Arnold', lastName: 'Smith' });
      });

      it('does not updates model if values has not changed', () => {
        store.set(Model, { id: '1', firstName: 'John', lastName: 'Smith' });
        const userBefore = store.get(Model, '1');

        store.set(userBefore, { firstName: 'John' });
        const userAfter = store.get(Model, '1');

        expect(userAfter).toBe(userBefore);
      });

      it('removes instance from store', () => {
        store.set(Model, { firstName: 'John', lastName: 'Smith' });
        const user = store.get(Model);
        store.set(user, null);

        expect(store.get(Model)).toBe(null);
      });

      it('returns computed property', () => {
        store.set(Model, { firstName: 'John', lastName: 'Smith' });
        expect(store.get(Model).fullName).toBe('John Smith');
      });
    });

    describe('for an object property', () => {
      let Model;
      beforeEach(() => {
        Model = {
          attributes: {
            one: Number,
            two: Number,
          },
        };

        store.set(Model, { id: '1', attributes: { one: 2, two: 1 } });
      });

      it('returns nested attributes', () => {
        const model = store.get(Model, '1');
        expect(model).toEqual({ attributes: { one: 2, two: 1 } });
      });

      it('stringifies returned nested attributes', () => {
        const model = store.get(Model, '1');
        expect(JSON.stringify(model)).toEqual(JSON.stringify({ attributes: { one: 2, two: 1 } }));
      });

      it('throws when setting nested object', () => {
        const model = store.get(Model, '1');
        expect(() => { model.attributes = {}; }).toThrow();
      });

      it('updates nested object by instance reference', () => {
        const modelBefore = store.get(Model, '1');
        store.set(modelBefore, { attributes: { one: 3 } });
        const modelAfter = store.get(Model, '1');

        expect(modelAfter).not.toBe(modelBefore);
        expect(modelBefore.attributes).toEqual({ one: 3, two: 1 });
        expect(modelAfter.attributes).toEqual({ one: 3, two: 1 });
      });

      it('does not update nested object when values has not changed', () => {
        const modelBefore = store.get(Model, '1');
        const attrBefore = modelBefore.attributes;

        store.set(Model, { id: '1', attributes: { one: 2, two: 1 } });
        const modelAfter = store.get(Model, '1');
        const attrAfter = modelAfter.attributes;

        expect(attrBefore).toBe(attrAfter);
        expect(modelAfter.attributes).toEqual({ one: 2, two: 1 });
      });

      it('does not update root object when nested reference has not changed', () => {
        const modelBefore = store.get(Model, '1');
        store.set(Model, { id: '1', attributes: modelBefore.attributes });
        const modelAfter = store.get(Model, '1');

        expect(modelAfter).toBe(modelBefore);
        expect(modelAfter.attributes).toEqual({ one: 2, two: 1 });
      });

      it('update root object when update root with new nested object', () => {
        const modelBefore = store.get(Model, '1');
        store.set(Model, { id: '1', attributes: { one: 3 } });
        const modelAfter = store.get(Model, '1');

        expect(modelAfter).not.toBe(modelBefore);
        expect(modelAfter.attributes).toEqual({ one: 3, two: 1 });
      });

      it('only updates nested object by its definition reference', () => {
        const modelBefore = store.get(Model, '1');
        store.set(modelBefore.attributes, { one: 3 });
        const modelAfter = store.get(Model, '1');

        expect(modelAfter).toBe(modelBefore);
        expect(modelAfter.attributes).toEqual({ one: 3, two: 1 });
      });

      it('updates nested object by id', () => {
        store.set(Model.attributes, { id: 'custom', one: 10, two: 20 });
        store.set(Model, { attributes: 'custom' });
        const model = store.get(Model);
        expect(model.attributes).toEqual({ one: 10, two: 20 });
      });
    });

    describe('for an array property', () => {
      let Model;
      let ExternalModel;

      beforeEach(() => {
        ExternalModel = { firstName: String, lastName: String };

        Model = {
          arbitrary: [],
          transformAsValue: [String],
          internalObjects: [{ test: String }],
          externalObjects: [ExternalModel],
        };

        store.set(Model, { id: '1' });
        store.set(ExternalModel, { id: '1', firstName: 'John', lastName: 'Smith' });

        store.set(Model, {
          id: '2',
          arbitrary: [1, '2', true, {}],
          transformAsValue: ['1', 2, true, null, undefined],
          internalObjects: [{ test: 'one' }, {}],
          externalObjects: ['1', { id: '2', firstName: 'Mary', lastName: 'Jane' }, '3'],
        });
      });

      it('throws when nested property is null', () => {
        const BrokenModel = { property: [null] };
        expect(() => store.set(BrokenModel, {})).toThrow();
      });

      it('throws when nested property is other than function or object', () => {
        const BrokenModel = { property: [''] };
        expect(() => store.set(BrokenModel, {})).toThrow();
      });

      it('throws when try update with value other than an array', () => {
        expect(() => store.set(Model, { id: '3', arbitrary: '' })).toThrow();
      });

      it('returns empty array when value is not provided', () => {
        const model = store.get(Model, '1');
        expect(model.arbitrary).toEqual([]);
        expect(model.transformAsValue).toEqual([]);
        expect(model.internalObjects).toEqual([]);
        expect(model.externalObjects).toEqual([]);
      });

      it('returns an array of not transformed values', () => {
        const model = store.get(Model, '2');
        expect(model.arbitrary).toEqual([1, '2', true, {}]);
      });

      it('returns an array of transformed values', () => {
        const model = store.get(Model, '2');
        expect(model.transformAsValue).toEqual(['1', '2', 'true', 'null', '']);
      });

      it('returns an array of internal objects', () => {
        const model = store.get(Model, '2');
        expect(model.internalObjects).toEqual([{ test: 'one' }, { test: '' }]);
      });

      it('does not update array when values has not changed', () => {
        const modelBefore = store.get(Model, '2');
        const attrBefore = modelBefore.transformAsValue;

        store.set(Model, { id: '2', transformAsValue: [...attrBefore] });
        const modelAfter = store.get(Model, '2');
        const attrAfter = modelAfter.transformAsValue;

        expect(attrBefore).toBe(attrAfter);
        expect(attrAfter).toEqual(['1', '2', 'true', 'null', '']);
      });

      it('updates internal objects', () => {
        const model = store.get(Model, '2');
        store.set(model, { internalObjects: [{ test: 'two' }, { test: 'three' }] });
        const modelAfter = store.get(Model, '2');
        expect(modelAfter.internalObjects).toEqual([{ test: 'two' }, { test: 'three' }]);
      });

      it('returns an array of external objects', () => {
        const model = store.get(Model, '2');
        expect(model.externalObjects).toEqual([
          { firstName: 'John', lastName: 'Smith' },
          { firstName: 'Mary', lastName: 'Jane' },
          undefined,
        ]);
      });

      it('updates value of an external object', () => {
        const model = store.get(Model, '2');
        expect(model.externalObjects[2]).toBe(undefined);

        store.set(ExternalModel, { id: '3', firstName: 'Mary', lastName: 'Jane' });

        expect(model.externalObjects[2]).toEqual({ firstName: 'Mary', lastName: 'Jane' });
      });
    });
  });


  describe('list method -', () => {
    let Model;
    beforeEach(() => {
      Model = {
        firstName: String,
        lastName: String,
        fullName: ({ firstName, lastName }) => `${firstName} ${lastName}`,
      };
      store.set(Model, { id: '1', firstName: 'John', lastName: 'Smith' });
      store.set(Model, { id: '2', firstName: 'Mary', lastName: 'Jane' });
    });

    it('throws when Model is not an object', () => {
      expect(() => { store.list('1'); }).toThrow();
    });

    it('throws when parameters are not an object', () => {
      expect(() => { store.list(Model, ''); }).toThrow();
    });

    it('throws when parameters have nested objects', () => {
      expect(() => { store.list(Model, { a: { b: 'c' } }); }).toThrow();
    });

    it('returns a list of models', () => {
      const users = store.list(Model);
      expect(users.length).toBe(2);
      expect(users[0]).toEqual({ firstName: 'John', lastName: 'Smith' });
      expect(users[1]).toEqual({ firstName: 'Mary', lastName: 'Jane' });
    });

    it('returns cached list of models', () => {
      const usersOne = store.list(Model);
      const usersTwo = store.list(Model);
      expect(usersOne).toBe(usersTwo);
    });

    it('returns empty list for not setup Model', () => {
      expect(store.list({})).toEqual([]);
    });

    it('does not return removed model', () => {
      const user1 = store.get(Model, 1);
      store.set(user1, null);

      const users = store.list(Model);
      expect(users.length).toBe(1);
      expect(users[0]).toEqual({ firstName: 'Mary', lastName: 'Jane' });
    });

    it('returns added model', () => {
      const usersBefore = store.list(Model);
      store.set(Model, { firstName: 'Arnold', lastName: 'Grey' });
      const usersAfter = store.list(Model);

      expect(usersBefore.length).toBe(2);
      expect(usersAfter.length).toBe(3);
      expect(usersAfter[2]).toEqual({ firstName: 'Arnold', lastName: 'Grey' });
    });

    it('returns cached list when model updates', () => {
      const usersBefore = store.list(Model);
      store.set(Model, { id: '1', firstName: 'Arnold', lastName: 'Grey' });
      const usersAfter = store.list(Model);

      expect(usersBefore).toBe(usersAfter);
      expect(usersAfter[0]).toEqual({ firstName: 'Arnold', lastName: 'Grey' });
    });

    it('returns empty list for defined parameters without adapter', () => {
      const users = store.list(Model, { firstName: 'John' });
      expect(users).toEqual([]);
    });
  });

  xdescribe('connect method -', () => {
    describe('synchronous adapter', () => {
      let storage;
      let Model;

      beforeEach(() => {
        storage = {
          1: { firstName: 'John', lastName: 'Smith' },
          2: { firstName: 'Mary', lastName: 'Jane' },
        };

        Model = {
          firstName: String,
          lastName: String,
        };

        store.connect(Model, {
          get(id, lastValue) {
            if (!lastValue) {
              return storage[id];
            }
            return lastValue;
          },
          set(id, value) {
            storage[id] = value;
          },
        });
      });

      it('returns models from storage', () => {
        const userOne = store.get(Model, '1');
        const userTwo = store.get(Model, '2');

        expect(userOne).toEqual({ firstName: 'John', lastName: 'Smith' });
        expect(userTwo).toEqual({ firstName: 'Mary', lastName: 'Jane' });
      });

      it('returns model from cache', () => {
        expect(store.get(Model, '1')).toBe(store.get(Model, '1'));
      });

      it('updates storage', () => {
        const userOne = store.get(Model, '1');

        store.set(userOne, { firstName: 'Mary' });
        expect(storage[1]).toEqual({ firstName: 'Mary', lastName: 'Smith' });
      });
    });
  });
});
