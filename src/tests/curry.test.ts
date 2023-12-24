import * as _ from '..'
import type { DebounceFunction } from '../curry'

describe('curry module', () => {
  describe('pipe function', () => {
    test('calls all given functions', () => {
      const addFive = (num: number) => num + 5
      const twoX = (num: number) => num * 2
      const func = _.pipe(addFive, twoX)
      const result = func(0)
      expect(result).toBe(10)
    })
  })

  test('calls add(1), then addFive, then twoX functions by 1', () => {
    const add = (y: number) => (x: number) => x + y
    const addFive = add(5)
    const twoX = (num: number) => num * 2
    const func = _.pipe(add(1), addFive, twoX)
    const result = func(1)
    expect(result).toBe(14)
  })

  test('calls add(2), then addFive, then twoX, then repeatX functions by 1', () => {
    const add = (y: number) => (x: number) => x + y
    const addFive = add(5)
    const twoX = (num: number) => num * 2
    const repeatX = (num: number) => 'X'.repeat(num)
    const func = _.pipe(add(2), addFive, twoX, repeatX)
    const result = func(1)
    expect(result).toBe('XXXXXXXXXXXXXXXX')
  })

  test('calls addFive, then add(2), then twoX, then repeatX functions by 1', () => {
    const add = (y: number) => (x: number) => x + y
    const addFive = add(5)
    const twoX = (num: number) => num * 2
    const repeatX = (num: number) => 'X'.repeat(num)
    const func = _.pipe(addFive, add(2), twoX, repeatX)
    const result = func(1)
    expect(result).toBe('XXXXXXXXXXXXXXXX')
  })

  test('calls getName, then upperCase functions as a mapper for User[]', () => {
    type User = { id: number; name: string }
    const users: User[] = [
      { id: 1, name: 'John Doe' },
      { id: 2, name: 'John Smith' },
      { id: 3, name: 'John Wick' }
    ]
    const getName = <T extends { name: string }>(item: T) => item.name
    const upperCase: (x: string) => Uppercase<string> = (text: string) =>
      text.toUpperCase() as Uppercase<string>

    const getUpperName = _.pipe<User, Uppercase<string>>(getName, upperCase)
    const result = users.map(getUpperName)
    expect(result).toEqual(['JOHN DOE', 'JOHN SMITH', 'JOHN WICK'])
  })

  describe('proxied function', () => {
    test('returns proxy that calls callback function', () => {
      const handler = (propertyName: string) => {
        if (propertyName === 'x') return 2
        if (propertyName === 'getName') return () => 'radash'
        return undefined
      }
      const proxy = _.proxied(handler) as any
      expect(proxy.x).toBe(2)
      expect(proxy.getName()).toBe('radash')
      expect(proxy.nil).toBeUndefined()
    })
  })

  describe('memo function', () => {
    test('only executes function once', () => {
      const func = _.memo(() => new Date().getTime())
      const resultA = func()
      const resultB = func()
      expect(resultA).toBe(resultB)
    })
    test('uses key to identify unique calls', () => {
      const func = _.memo(
        ({ id }: { id: string }) => {
          const ts = new Date().getTime()
          return `${ts}::${id}`
        },
        {
          key: ({ id }: { id: string }) => id
        }
      )
      const resultA = func({ id: 'alpha' })
      const resultB = func({ id: 'beta' })
      const resultA2 = func({ id: 'alpha' })
      expect(resultA).toBe(resultA2)
      expect(resultB).not.toBe(resultA)
    })
    test('calls function again when first value expires', async () => {
      const func = _.memo(() => new Date().getTime(), {
        ttl: 1
      })
      const resultA = func()
      await new Promise(res => setTimeout(res, 100))
      const resultB = func()
      expect(resultA).not.toBe(resultB)
    })
    test('does not call function again when first value has not expired', async () => {
      const func = _.memo(() => new Date().getTime(), {
        ttl: 1000
      })
      const resultA = func()
      await new Promise(res => setTimeout(res, 100))
      const resultB = func()
      expect(resultA).toBe(resultB)
    })
  })

  describe('debounce function', () => {
    let func: DebounceFunction<any>
    const mockFunc = jest.fn()
    const runFunc3Times = () => {
      func()
      func()
      func()
    }

    beforeEach(() => {
      func = _.debounce({ delay: 600 }, mockFunc)
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    test('only executes once when called rapidly', async () => {
      runFunc3Times()
      expect(mockFunc).toHaveBeenCalledTimes(0)
      await _.sleep(610)
      expect(mockFunc).toHaveBeenCalledTimes(1)
    })

    test('does not debounce after cancel is called', () => {
      runFunc3Times()
      expect(mockFunc).toHaveBeenCalledTimes(0)
      func.cancel()
      runFunc3Times()
      expect(mockFunc).toHaveBeenCalledTimes(3)
      runFunc3Times()
      expect(mockFunc).toHaveBeenCalledTimes(6)
    })

    test('executes the function immediately when the flush method is called', () => {
      func.flush()
      expect(mockFunc).toHaveBeenCalledTimes(1)
    })

    test('continues to debounce after flush is called', async () => {
      runFunc3Times()
      expect(mockFunc).toHaveBeenCalledTimes(0)
      func.flush()
      expect(mockFunc).toHaveBeenCalledTimes(1)
      func()
      expect(mockFunc).toHaveBeenCalledTimes(1)
      await _.sleep(610)
      expect(mockFunc).toHaveBeenCalledTimes(2)
      func.flush()
      expect(mockFunc).toHaveBeenCalledTimes(3)
    })

    test('cancels all pending invocations when the cancel method is called', async () => {
      const results: boolean[] = []
      func()
      results.push(func.isPending())
      results.push(func.isPending())
      await _.sleep(610)
      results.push(func.isPending())
      func()
      results.push(func.isPending())
      await _.sleep(610)
      results.push(func.isPending())
      expect(results).toEqual([true, true, false, true, false])
    })

    test('returns if there is any pending invocation when the pending method is called', async () => {
      func()
      func.cancel()
      await _.sleep(610)
      expect(mockFunc).toHaveBeenCalledTimes(0)
    })
  })

  describe('throttle function', () => {
    test('throttles!', async () => {
      let calls = 0
      const func = _.throttle({ interval: 600 }, () => calls++)
      func()
      func()
      func()
      expect(calls).toBe(1)
      await _.sleep(610)
      func()
      func()
      func()
      expect(calls).toBe(2)
    })

    test('returns if the throttle is active', async () => {
      const results = []
      const func = _.throttle({ interval: 600 }, () => {})
      results.push(func.isThrottled())
      func()
      results.push(func.isThrottled())
      func()
      results.push(func.isThrottled())
      func()
      results.push(func.isThrottled())
      await _.sleep(610)
      results.push(func.isThrottled())
      expect(results).toEqual([false, true, true, true, false])
    })
  })
})
