import { useAuth } from '../auth-context'
import ProblemFeed from './ProblemFeed'
import Layout from './Layout'
import Landing from './Landing'

function Home() {
    const { user, loading } = useAuth()

    if (loading) return <Layout>{null}</Layout>

    if (!user) return <Layout><Landing /></Layout>

    return <Layout><ProblemFeed /></Layout>
}

export default Home
