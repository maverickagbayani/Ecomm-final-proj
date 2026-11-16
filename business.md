4. The business case

4.1GC1 traceability
Target market
    GC1
        Customer segments
        Primary: young professionals to middle aged adults aged 30-59 with an annual household income ranging from PHP 100,000 to PHP 130,000
        Secondary: local travelers who frequently transit through Quezon City while journeying to various regional destinations

        Geographic: located ion Quezon city and the broader NCR

        Psychographic: prioritize convenience, values eco friendly innovation, energy efficiency and modern technology
    
    where it shows up in the build
        Only charging stations within Quezon city is displayed and it also shows the estimated charging time for booking page

Problem statement
    GC1
        EV owners in the Philippines face significant problems when it comes to waiting times and uncertainty with a charging station’s availability

    where it shows up in the build
        It shows the number of chargers available per charging station including the type of chargers, charging speed at the booking page .

Value proposition
    GC1
        Provide the estimated completion time of charging based on the car model and the type of charger you choose in the website 

    where it shows up in the build
        The customers can see at the homepage that “know when your charge will finish before you leave home”.

        When they click on the charging station they want to go to, it’s immediately going to show estimated charging time. This will adjust when you change your car model, current battery percentage and desired charging percentage
    
Monetization model
    GC1 
        Reservation fee and refundable overstay deposit

    where it shows up in the build
        It is computed right at the booking page. This shows the estimated total as well as its breakdown which includes the charging cost, reservation fee and refundable overstay deposit. 

Core platform features
    GC1
        Live map of available charging stations indicating how many charging stations is available

        Estimates charging time of the car depending on charger used and car model

    where it shows up in the build
        Live Map: front end - max/map.html and frontend-map/index.html

        Estimated Charging Time: shop/station.html and station.js


4.2. Funnel map


Home
elements used
    Call to action buttons: allows customers to start looking for a charging station without having to scroll down

    Live availability summary card: allows customers to see that the website provides live data

    How it works card: allows the customers to understand how the website works

endpoints
    GET /api/products

number it moves:
    Home-to-Browse click-through rate

Browse
elements used
    Search bar: makes it easier for customers to look for stations near them

    Sort tabs: allows the customers to easily find which station provides the cheapest rates, which has their charger type or which is the nearest one to them

    Live map: allows the customers to visualize where the different charging stations are the different availabilities

endpoints: 
    GET /api/products?q=.. and GET /api/stations

number it moves:
    Browse-to-Detail click-through rate

Select
elements used
    Report an issue button: allows the users to easily report an issue so that it can be fixed as fast as possible 

    Battery percentage input box: allows the website to calculate the estimated charging time

    Model input box:  allows the website to calculate the estimated charging time

    Live estimated bill: allows the user to see how much they will need to pay and its breakdown

    Date and time slot picker: allows the website to check the number of available sockets

endpoints:
    GET /api/products/:id

number it moves:
    add-to-cart rate

Confirm
elements:
    Itemized order summary table: it lists down the breakdown for the total payment and the details of the order for the customer to double check if they were able to input the proper details 

    Customer name & email form fields: collects the booking details and highlights the missing/invalid fields

    Payment method modal: allows the customers to easily see all the payment options in a pop-up modal

endpoints:
    POST /api/orders

number it moves:
    Checkout completion rate

Save
elements:
    Order reference number: confirms that the booking went through

    reservation receipt card: it summarizes the details of the transaction

    Download receipt button: allows the customer to save an offline copy of their booking details

    Book another socket buttons: gives customers a shortcut to make another booking

endpoints:
    GET /api/orders/:id

number it moves:
    Completed orders & repeat order rate



4.3 Business rules


Rule, in plain words
Enforced where (route/function)
What the customer sees when it applies


rule 1: Nobody can book a station if all sockets are taken
    enforced where: POST /api/orders in server.js (socket.stock < 1) and checkout.js
    What the customer sees when it applies: "No free sockets at this station" 

rule 2: Every reservation has a ₱50 booking fee and a ₱100 refundable overstay deposit on top of the kWh rate
    enforced where: POST /api/orders in server.js (RESERVATION_FEE = 50, DEPOSIT = 100) and billFor() in app.js
    What the customer sees when it applies: The booking fee  and overstay deposit show up as separate line items in the itemized bill

rule 3: Customers can't book a charging session for 0 or negative kWh
    enforced where: POST /api/orders in server.js (Number(kwh) <= 0)
    What the customer sees when it applies: "kwh must be greater than 0"

rule 4: You can't reserve a charging slot on a date that has already passed
    enforced where: POST /api/orders in server.js (slot.getTime() < Date.now() - 300000)
    What the customer sees when it applies: "Arrival time must be in the future"

rule 5: Customers can only pay using our four supported payment methods
    enforced where: POST /api/orders in server.js (VALID_PAYMENT_METHODS)
    What the customer sees when it applies: Only GCash, Maya Wallet, Card, and Watt Credits buttons appear on the pop-up modal


4.4 Revenue features
A customer books a 15kWh charging station at UP town center which is a paid station. This will cost  ₱390 for the charging cost with an additional ₱50 reservation fee and ₱100 refundable overstay deposit. The total that the customer will pay for is ₱540 (₱440 non-refundable gross revenue). Wattspot keeps the ₱50 reservation fee while the ₱390 will go to the charging station host. This works for us only if the customer is willing to pay an extra ₱50 to reserve a charger, so Wattspot should ensure that the data provided about the charging stations is accurate and that there will be no double bookings to keep customer trust and satisfaction. 
When a customer overstays, the driver must forfeit the ₱100 refundable overstay deposit. This will increase Wattspot’s revenue from ₱50 per booking from the reservation fee to ₱150. This will compensate for the loss from the next booking. The overstay deposit increases the initial payment of the customer, so Wattspot needs to establish a clear grace period and a notification for drivers when their timeslot is about to finish. 

4.5 What the owner does with the numbers
Owner numbers:
Total orders: if the total weekly bookings is lower than our target, the ₱50 reservation fee can be reduced during off peak hours to attract more customers.
Total revenue: The total revenue will be used by the owner to assess whether they are capable of expanding the website to more locations outside of Quezon city. 
Average order value: If the average order value is high in terms of the number of kWh meaning there are more people charging for a long period of time, the owner can test giving discounts on the ₱50 reservation fee  to customers who only need to charge their vehicle for a short period of time. 
Top-selling station: The owner can look into adding more charging sockets at the top selling station in terms of number of bookings. 
Low stock: When a charging station always has zero to low stock, the owner can also look into adding more charging sockets or promote nearby available locations. 


