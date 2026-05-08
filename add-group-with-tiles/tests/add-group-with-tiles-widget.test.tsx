import { React } from 'jimu-core'
import _Widget from '../src/runtime/widget'
import { widgetRender, wrapWidget } from 'jimu-for-test'

const render = widgetRender()
describe('test add group with tiles widget', () => {
  it('add group with tiles test', () => {
    const Widget = wrapWidget(_Widget, {
      config: { exampleConfigProperty: 'a' }
    })
    const { queryByText } = render(<Widget widgetId="Widget_1" />)
    expect(queryByText('exampleConfigProperty: a').tagName).toBe('P')
  })
})
