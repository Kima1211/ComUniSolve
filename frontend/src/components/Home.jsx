import { useAuth } from '../auth-context'
import ProblemFeed from './ProblemFeed'
import Layout from './Layout'
import Landing from './Landing'

// Same URL for everyone: guests get the landing page (which ends with the feed), members get the feed.
function Home() {
    const { user, loading } = useAuth()

    if (loading) return <Layout>{null}</Layout>

    if (!user) return <Layout><Landing /></Layout>

    return <Layout><ProblemFeed /></Layout>
}

export default Home
